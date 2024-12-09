"use strict";

//CSS
import "./css/header.css";
import "./css/style.css";
import DataTable from "datatables.net";
import "datatables.net-dt/css/dataTables.dataTables.css";
import { baseUrl, d2Delete, d2Get, performPostAndGet } from "./js/d2api.js";
window.DataTable = DataTable;

function getContextPath() {
    var ctx = window.location.pathname.substring(0, window.location.pathname.indexOf("/", 1));
    console.log("Context path: " + ctx);
    if (ctx == "/api") return "";
    return ctx;
}

const check_code = "dashboards_no_items";

async function getDashboardProperties() {
    try {
        const endpoint = "dashboards?fields=id,lastUpdated,access&paging=false";
        return await d2Get(endpoint);
    } catch (error) {
        console.error("Error getting dashboard properties:", error);
    }
}

async function renderDetailsTable(detailsObject, dashboard_properties, user_is_super) {
    if (!user_is_super) {
        detailsObject.issues = detailsObject.issues.filter((issue) => {
            const dashboard = dashboard_properties.dashboards.find((dashboard) => dashboard.id === issue.id);
            return dashboard && dashboard.access.delete;
        });
    }

    detailsObject.issues.forEach((issue) => {
        const dashboard = dashboard_properties.dashboards.find((dashboard) => dashboard.id === issue.id);
        if (dashboard) {
            const lastUpdated = new Date(dashboard.lastUpdated);
            const now = new Date();
            const diffTime = Math.abs(now - lastUpdated);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            issue.comment = diffDays;
        } else {
            issue.comment = "Unknown";
        }
    });

    let html = "<div id='details_table'><h2>Empty dashboards</h2>";
    html += "<h3>Dashboards with no content</h3>";
    html += "<table id='details' class='display' width='100%'>";
    html += "<thead><tr><th>Dashboard name</th><th>ID</th><th>Last updated (days ago)</th><th>Delete</th><th>Select</th></thead><tbody>";
    detailsObject.issues.forEach((issue) => {
        html += "<tr>";
        html += `<td>${issue.name}</td>`;
        html += `<td><a href='${baseUrl}/dhis-web-dashboard/#/${issue.id}' target='_blank'>${issue.id}</a></td>`;
        html += `<td>${issue.comment}</td>`;
        html += `<td><button onclick='deleteSelectedDashboard("${issue.id}")'>Delete</button></td>`;
        html += `<td><input type='checkbox' class='dashboard-select' value='${issue.id}'></td>`;
        html += "</tr>";
    });
    
    html += "</tbody></table></div>";
      //Include the buttons if there are dashboards to delete
    if (detailsObject.issues.length > 0) {
        html += "<div id='delete_buttons'><button onclick='deleteSelectedDashboards()'>Delete selected dashboards</button>";
        html += "<button onclick='deleteAllEmptyDashboards()'>Delete all empty dashboards</button></div>";
    }

    return html;
}

async function runDetails(code) {
    let user_is_super = false;
    const path = `dataIntegrity/details?checks=${code}`;
    try {
        user_is_super = await checkUserIsSuperUser();
        const dashboard_properties = await getDashboardProperties();
        const data = await performPostAndGet(path);
        const name = Object.keys(data)[0];
        const this_check = data[name];
        const this_html = await renderDetailsTable(this_check, dashboard_properties, user_is_super);
        document.getElementById("detailsReport").innerHTML = this_html;
        new DataTable("#details", { paging: true, searching: true, order: [[1, "desc"]] });
    } catch (error) {
        console.error("Error in runDetails:", error);
    }
}

async function deleteSelectedDashboard(uid) {
    if (confirm("Are you sure you want to delete this dashboard?")) {
        d2Delete(`dashboards/${uid}`).then(() => {
            alert("Dashboard deleted");
            runDetails(check_code);
        });
    }
}

async function deleteSelectedDashboards() {
    const selectedCount = document.querySelectorAll(".dashboard-select:checked").length;
    if (confirm(`You are about to delete ${selectedCount} dashboards. This operation cannot be undone. Are you sure?`)) {
        const selectedDashboards = Array.from(document.querySelectorAll(".dashboard-select:checked")).map(checkbox => checkbox.value);
        const maxConcurrentRequests = 10;

        try {
            let successCount = 0;
            let failureCount = 0;
            document.getElementById("statusReport").innerHTML = `Deleting ${selectedDashboards.length} dashboards...`;
            for (let i = 0; i < selectedDashboards.length; i += maxConcurrentRequests) {
                const batch = selectedDashboards.slice(i, i + maxConcurrentRequests);
                const results = await Promise.all(batch.map(async uid => {
                    try {
                        await d2Delete(`dashboards/${uid}`);
                        return 200;
                    } catch (error) {
                        console.error(`Error deleting dashboard ${uid}:`, error);
                        return error.status || 500;
                    }
                }));

                successCount += results.filter(status => status === 200).length;
                failureCount += results.filter(status => status !== 200).length;
                document.getElementById("statusReport").innerHTML = `Working to delete ${selectedDashboards.length - successCount - failureCount} dashboards...`;
            }
            document.getElementById("statusReport").innerHTML = "";
            await runDetails(check_code);
            alert(`Deletion summary: ${successCount} succeeded, ${failureCount} failed`);
        } catch (error) {
            console.error("Error deleting dashboards:", error);
        }
    }
}

async function checkVersion() {
    try {
        const data = await d2Get("/api/system/info");
        const version = data.version.split(".")[1];
        console.log("DHIS2 version:", version);
        return version;
    } catch (error) {
        console.error("Error checking DHIS2 version:", error);
        return false;
    }
}

async function checkUserIsSuperUser() {
    try {
        const data = await d2Get("me?fields=userRoles[id,name,authorities]");
        const isSuperUser = data.userRoles.some(role => role.authorities.includes("ALL"));
        return isSuperUser;
    } catch (error) {
        console.error("Error checking user roles:", error);
        return false;
    }
}

async function deleteAllEmptyDashboards() {
    document.querySelectorAll(".dashboard-select").forEach(checkbox => checkbox.checked = true);
    deleteSelectedDashboards();
}

window.getContextPath = getContextPath;
window.deleteAllEmptyDashboards = deleteAllEmptyDashboards;
window.deleteSelectedDashboard = deleteSelectedDashboard;
window.deleteSelectedDashboards = deleteSelectedDashboards;
window.getDashboardProperties = getDashboardProperties;
window.baseUrl = baseUrl;

(async () => {
    const version = await checkVersion();
    const is_supported = version >= 39;
    if (is_supported) {
        runDetails(check_code);
    } else {
        document.getElementById("detailsReport").innerHTML = "<h2>Unsupported DHIS2 version</h2>";
    }
})();
