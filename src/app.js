"use strict";

//CSS
import "./css/header.css";
import "./css/style.css";
import DataTable from "datatables.net";
import "datatables.net-dt/css/dataTables.dataTables.css";
import { baseUrl, d2Delete, d2Get, d2PostJson, performPostAndGet } from "./js/d2api.js";
window.DataTable = DataTable;

function getContextPath() {
    var ctx = window.location.pathname.substring(0, window.location.pathname.indexOf("/", 1));
    if (ctx == "/api") return "";
    return ctx;
}

const checks = [{ "dashboards_no_items": "Dashboards with no items" },
{ "dashboards_not_viewed_one_year": "Dashboards not viewed in one year" }];

function renderTypeSelect() {
    let html = "<select id='checkSelect' onchange='runDetails(this.value)'>";
    checks.forEach((check) => {
        const key = Object.keys(check)[0];
        const value = check[key];
        html += `<option value='${key}'>${value}</option>`;
    });
    html += "</select>";
    return html;
}

async function getMetadataIntegrityChecks() {
    try {
        const endpoint = "dataIntegrity";
        return await d2Get(endpoint);
    } catch (error) {
        console.error("Error getting metadata integrity checks:", error);
    }
}


//Global variable to store the check code
var check_code = "dashboards_no_items";
//Global to store the checks metadata
var checks_metadata = {};

var me  = {};

async function getDashboardProperties() {
    try {
        const endpoint = "dashboards?fields=id,created,lastUpdated,access,sharing&paging=false";
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
        const getLastUpdatedDays = (dateString) => {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        };
        const dashboard = dashboard_properties.dashboards.find((dashboard) => dashboard.id === issue.id);

        if (issue.comment) {
            issue.comment = getLastUpdatedDays(issue.comment);
        } else {
            if (dashboard) {
                issue.comment = getLastUpdatedDays(dashboard.lastUpdated);
            } else {
                issue.comment = "Unknown";
            }
        }

        if (dashboard) {
            issue.created = getLastUpdatedDays(dashboard.created);
        } else {
            issue.created = "Unknown";
        }
    });



    //Determine if the dashboard has public access
    detailsObject.issues.forEach((issue) => {
        const dashboard = dashboard_properties.dashboards.find((dashboard) => dashboard.id === issue.id);
        if (dashboard) {
            issue.publicAccess = dashboard.sharing.public.startsWith("rw") ? "Public" : "Private";
        } else {
            issue.publicAccess = "Unknown";
        }
    });

    let html = "<div id='details_table'>";
    html += "<table id='details' class='display' width='100%'>";
    html += "<thead><tr><th>Dashboard name</th><th>ID</th><th>Created (days ago)</th><th>Last updated (days ago)</th><th>Share with me</th><th>Access</th><th>Delete</th><th>Select</th></thead><tbody>";
    detailsObject.issues.forEach((issue) => {
        html += "<tr>";
        html += `<td>${issue.name}</td>`;
        html += `<td><a href='${baseUrl}/dhis-web-dashboard/#/${issue.id}' target='_blank'>${issue.id}</a></td>`;
        html += `<td>${issue.created}</td>`;
        html += `<td>${issue.comment}</td>`;
        html += `<td><button onclick='shareDashboardWithAlert("${issue.id}")'>Share</button></td>`;
        html += `<td>${issue.publicAccess}</td>`;
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

async function runDetails(code, me) {
    //Update the global variable
    check_code = code;
    let user_is_super = false;
    const path = `dataIntegrity/details?checks=${code}`;
    try {
        user_is_super = await checkUserIsSuperUser(me);
        const dashboard_properties = await getDashboardProperties();
        const data = await performPostAndGet(path);
        const name = Object.keys(data)[0];
        const this_check = data[name];
        const this_html = await renderDetailsTable(this_check, dashboard_properties, user_is_super);
        document.getElementById("detailsReport").innerHTML = this_html;
        new DataTable("#details", { paging: true, searching: true, order: [[2, "desc"]] });
    } catch (error) {
        console.error("Error in runDetails:", error);
    }
}

async function deleteSelectedDashboard(uid) {
    if (confirm("Are you sure you want to delete this dashboard?")) {
        await shareDashboardWithCurrentUser(uid);
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
                        await shareDashboardWithCurrentUser(uid);
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
        var version = data.version.split(".")[1];
        //Only consider the digits
        version = parseInt(version.match(/\d+/)[0]);
        return version;
    } catch (error) {
        console.error("Error checking DHIS2 version:", error);
        return false;
    }
}

async function getMe() {
    try {
        const data = await d2Get("me?fields=id,userRoles[id,name,authorities]");
        return data;
    } catch (error) {
        console.error("Error getting current user:", error);
    }
}

async function checkUserIsSuperUser() {
    try {
        return me.userRoles.some(role => role.authorities.includes("ALL"));
    } catch (error) {
        console.error("Error checking user roles:", error);
        return false;
    }
}

async function getCurrentUserUID() {
    try {
        return me.id;
    } catch (error) {
        console.error("Error getting current user UID:", error);
    }
}

async function deleteAllEmptyDashboards() {
    document.querySelectorAll(".dashboard-select").forEach(checkbox => checkbox.checked = true);
    deleteSelectedDashboards();
}

async function getDashboardSharing(dashboard_uid) {
    try {
        const sharing = await d2Get(`sharing?type=dashboard&id=${dashboard_uid}`);
        return sharing;
    } catch (error) {
        console.error("Error getting dashboard sharing:", error);
    }
}

async function  shareDashboardWithCurrentUser(dashboard_uid) {
    try {
        const sharing = await getDashboardSharing(dashboard_uid);
        sharing.object.userAccesses.push({ id: me.id, access: "rw------" });
        const resp = await d2PostJson(`sharing?type=dashboard&id=${dashboard_uid}`, sharing);
        return resp;
    } catch (error) {
        console.error("Error sharing dashboard with user:", error);
        alert("Error sharing dashboard with user");
    }
}

async function shareDashboardWithAlert(dashboard_uid) {
    if (confirm("Are you sure you want to share this dashboard with yourself?")) {
        await shareDashboardWithCurrentUser(dashboard_uid);
        alert("Dashboard shared with you");
    }
}   

window.getContextPath = getContextPath;
window.deleteAllEmptyDashboards = deleteAllEmptyDashboards;
window.deleteSelectedDashboard = deleteSelectedDashboard;
window.deleteSelectedDashboards = deleteSelectedDashboards;
window.getDashboardProperties = getDashboardProperties;
window.getDashboardSharing = getDashboardSharing;
window.getCurrentUserUID = getCurrentUserUID;
window.shareDashboardWithCurrentUser = shareDashboardWithCurrentUser;
window.renderDetailsTable = renderDetailsTable;
window.runDetails = runDetails;
window.checkVersion = checkVersion;
window.checkUserIsSuperUser = checkUserIsSuperUser;
window.shareDashboardWithAlert = shareDashboardWithAlert;
window.renderTypeSelect = renderTypeSelect;
window.baseUrl = baseUrl;

(async () => {
    renderTypeSelect();
    const version = await checkVersion();
    me = await getMe();
    const is_supported = version >= 39;
    if (is_supported) {
        checks_metadata = await getMetadataIntegrityChecks();
        //Render the select button for later
        document.getElementById("typeofCheck").innerHTML = renderTypeSelect();
        runDetails(check_code);
    } else {
        document.getElementById("detailsReport").innerHTML = "<h2>Unsupported DHIS2 version</h2>";
    }
})();
