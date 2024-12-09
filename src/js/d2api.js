const dhisDevConfig = DHIS_CONFIG;  
const isDev = "baseUrl" in dhisDevConfig;
export const baseUrl = isDev ? dhisDevConfig.baseUrl : "../../..";

// Helper function to set headers for development mode
const getHeaders = () => {
    let headers = new Headers();
    if (isDev) {
        headers.set("Authorization", "Basic " + btoa(dhisDevConfig.username + ":" + dhisDevConfig.password));
    }
    return headers;
};

// Helper function to standardize endpoint format
const formatEndpoint = (endpoint) => {
    // Remove any leading slashes
    if (endpoint.startsWith("/")) {
        endpoint = endpoint.slice(1);
    }

    // Remove any leading 'api/'
    if (endpoint.startsWith("api/")) {
        endpoint = endpoint.slice(4);
    }

    // Ensure the final format is /api/...
    // Ensure the final format is /api/...
    return `/api/${endpoint}`;
};

// Helper function to validate endpoint UID (11 characters, alphanumeric)
const validateUID = (endpoint) => {
    const uid = endpoint.split("/").pop();
    return /^[A-Za-z0-9]{11}$/.test(uid);
};


// Helper function to handle API errors and throw detailed error messages
const handleApiError = async (response) => {
    let errorMessage = "Network response was not ok";
    let errorDetail = await response.json(); // Capture the error response body text

    errorMessage = errorDetail.message || errorMessage;

    throw new Error(`${response.statusText} - ${errorMessage}`);
};

// GET from API async
export const d2Get = async (endpoint) => {
    try {
        endpoint = formatEndpoint(endpoint);
        let headers = getHeaders();
        let response = await fetch(baseUrl + endpoint, {
            method: "GET",
            headers: headers
        });
        if (!response.ok) {
            await handleApiError(response); // Handle the error response
        }
        let data = await response.json();
        return data;
    } catch (error) {
        console.log("ERROR in GET:");
        console.log(error);
        throw error;
    }
};

export const d2Patch = async (endpoint, body) => {
    try {
        endpoint = formatEndpoint(endpoint);

        if (!validateUID(endpoint)) {
            console.warn("Warning: The endpoint does not end with a valid 11-character UID");
        }

        let headers = getHeaders();
        headers.set("Content-Type", "application/json-patch+json");
        let response = await fetch(baseUrl + endpoint, {
            method: "PATCH",
            headers: headers,
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            await handleApiError(response); // Handle the error response
        }
        return { status: "success" };
    } catch (error) {
        console.log("ERROR in PATCH:");
        console.log(error);
        throw error;
    }
}

// POST to API async
export const d2PostJson = async (endpoint, body) => {
    try {
        endpoint = formatEndpoint(endpoint);
        let headers = getHeaders();
        headers.set("Content-Type", "application/json");
        let response = await fetch(baseUrl + endpoint, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            await handleApiError(response); // Handle the error response
        }
        let data = await response.json();
        return data;
    } catch (error) {
        console.log("ERROR in POST:");
        console.log(error);
        throw error;
    }
};

// PUT to API async
export const d2PutJson = async (endpoint, body) => {
    try {
        endpoint = formatEndpoint(endpoint);

        if (!validateUID(endpoint)) {
            console.warn("Warning: The endpoint does not end with a valid 11-character UID");
        }

        let headers = getHeaders();
        headers.set("Content-Type", "application/json");
        let response = await fetch(baseUrl + endpoint, {
            method: "PUT",
            headers: headers,
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            await handleApiError(response); // Handle the error response
        }
        let data = await response.json();
        return data;
    } catch (error) {
        console.log("ERROR in PUT:");
        console.log(error);
        throw error;
    }
};

// DELETE from API async
export const d2Delete = async (endpoint) => {
    try {
        endpoint = formatEndpoint(endpoint);

        if (!validateUID(endpoint)) {
            console.warn("Warning: The endpoint does not end with a valid 11-character UID");
        }

        let headers = getHeaders();
        let response = await fetch(baseUrl + endpoint, {
            method: "DELETE",
            headers: headers
        });
        if (!response.ok) {
            await handleApiError(response); // Handle the error response
        }
        return { status: "success" };
    } catch (error) {
        console.log("ERROR in DELETE:");
        console.log(error);
        throw error;
    }
};
export function performPostAndGet(endpoint) {
    endpoint = formatEndpoint(endpoint);
    return new Promise((resolve, reject) => {
        fetch(baseUrl + endpoint, {
            method: "POST",
            headers: getHeaders(),
        })
            .then(response => response.json())
            .then(() => {
                let tries = 0;

                function checkForResponse() {
                    fetch(baseUrl + endpoint, {
                        method: "GET",
                        headers: getHeaders(),
                    })
                        .then(response => response.json())
                        .then(getData => {
                            if (Object.keys(getData).length > 0 || tries >= 10) {
                                resolve(getData);
                            } else {
                                tries++;
                                setTimeout(checkForResponse, 1000);
                            }
                        })
                        .catch(error => {
                            console.error("Error checking for response:", error);
                            reject(error);
                        });
                }

                checkForResponse();
            })
            .catch(error => {
                console.error("Error making POST request:", error);
                reject(error);
            });
    });
}
