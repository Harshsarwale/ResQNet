
"use strict";

// ---------- Basic dashboard setup ----------

const $ = (id) => document.getElementById(id);

$("currentDate").textContent = new Date().toLocaleDateString("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

let reportCount = 0;
let userPosition = null;
let userMarker = null;
let accuracyCircle = null;
let emergencyMarker = null;
let trackingId = null;

// ---------- Interactive map ----------

let map = null;

if (typeof L !== "undefined" && $("map")) {
  // Initial view only. Actual GPS position is requested separately.
  map = L.map("map").setView([18.5204, 73.8567], 11);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  $("locationStatus").textContent =
    "Map ready. Click Find my location to show your GPS position.";

  // Allow the map to recalculate its size after layout.
  setTimeout(() => map.invalidateSize(), 300);

  // Click the map to mark a demo hazard.
  map.on("click", (event) => {
    const lat = event.latlng.lat;
    const lng = event.latlng.lng;

    if (emergencyMarker) {
      emergencyMarker.setLatLng(event.latlng);
    } else {
      emergencyMarker = L.marker(event.latlng).addTo(map);
    }

    emergencyMarker
      .bindPopup(
        `<strong>Demo hazard location</strong><br>
         Latitude: ${lat.toFixed(5)}<br>
         Longitude: ${lng.toFixed(5)}`
      )
      .openPopup();
  });
} else {
  $("locationStatus").textContent =
    "Map library unavailable. Check your internet connection and reload.";
}

// ---------- GPS location tracking ----------

function updateLocation(position) {
  userPosition = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy
  };

  const point = [userPosition.lat, userPosition.lng];

  if (!userMarker) {
    userMarker = L.marker(point)
      .addTo(map)
      .bindPopup("Your current device location");
  } else {
    userMarker.setLatLng(point);
  }

  if (!accuracyCircle) {
    accuracyCircle = L.circle(point, {
      radius: userPosition.accuracy,
      color: "#2563eb",
      fillColor: "#60a5fa",
      fillOpacity: 0.12
    }).addTo(map);
  } else {
    accuracyCircle.setLatLng(point);
    accuracyCircle.setRadius(userPosition.accuracy);
  }

  map.setView(point, 16);

  $("gpsSummary").textContent = "Active";
  $("locationStatus").textContent =
    `GPS updated: ${userPosition.lat.toFixed(5)}, ` +
    `${userPosition.lng.toFixed(5)}. Approximate accuracy: ` +
    `${Math.round(userPosition.accuracy)} metres.`;
}

function locationError(error) {
  const messages = {
    1: "Location permission denied. Allow location access in browser settings.",
    2: "Location unavailable. Check your device's location settings.",
    3: "Location request timed out. Please try again."
  };

  $("locationStatus").textContent =
    messages[error.code] || "Unable to get your location.";

  $("gpsSummary").textContent = "Unavailable";
}

$("locateBtn").addEventListener("click", () => {
  if (!map || !navigator.geolocation) {
    $("locationStatus").textContent =
      "Map or browser location support is unavailable.";
    return;
  }

  $("locationStatus").textContent =
    "Requesting GPS permission. Please allow location access.";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      updateLocation(position);

      if (trackingId !== null) {
        navigator.geolocation.clearWatch(trackingId);
      }

      trackingId = navigator.geolocation.watchPosition(
        updateLocation,
        locationError,
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 20000
        }
      );
    },
    locationError,
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000
    }
  );
});

$("stopTrackingBtn").addEventListener("click", () => {
  if (trackingId !== null) {
    navigator.geolocation.clearWatch(trackingId);
    trackingId = null;
    $("locationStatus").textContent = "Live GPS tracking stopped.";
    $("gpsSummary").textContent = "Stopped";
  } else {
    $("locationStatus").textContent =
      "No active GPS tracking session.";
  }
});

$("mapResetBtn").addEventListener("click", () => {
  if (map) {
    map.setView(
      userPosition
        ? [userPosition.lat, userPosition.lng]
        : [18.5204, 73.8567],
      userPosition ? 15 : 11
    );
  }
});

// ---------- Prepare an SMS to a trusted contact ----------

$("smsForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const phone = $("contactPhone").value.trim();
  const situation = $("smsSituation").value;
  const name = $("contactName").value.trim();
  const includeLocation = $("includeLocation").checked;

  // Accept international formats, including a leading +.
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 7 || digits.length > 15) {
    $("smsStatus").textContent =
      "Please enter a valid contact phone number.";
    return;
  }

  let message = `EMERGENCY ALERT\n${situation}`;

  if (name) {
    message += `\nFrom: ${name}`;
  }

  if (includeLocation && userPosition) {
    message +=
      `\nMy location: https://www.google.com/maps?q=` +
      `${userPosition.lat},${userPosition.lng}`;
    message +=
      `\nApproximate GPS accuracy: ` +
      `${Math.round(userPosition.accuracy)} metres`;
  } else if (includeLocation) {
    message +=
      "\nGPS coordinates unavailable. Please contact me for my location.";
  }

  message += "\nPlease contact me as soon as possible.";

  const smsUrl =
    `sms:${phone.replace(/[^\d+]/g, "")}` +
    `?body=${encodeURIComponent(message)}`;

  $("smsStatus").textContent =
    "Opening your messaging app. Review the recipient and message, then send it.";

  window.location.href = smsUrl;
});

// ---------- Report an incident ----------

$("reportForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const type = $("reportType").value;
  const severity = $("severity").value;
  const description = $("reportDescription").value.trim();
  const location = $("reportLocation").value.trim();

  if (!description) {
    $("reportStatus").textContent = "Please describe the incident.";
    return;
  }

  reportCount++;
  $("reportCount").textContent = reportCount;

  const details = [
    `Incident: ${type}`,
    `Severity: ${severity}`,
    `Description: ${description}`,
    `Location: ${location || "Not provided"}`,
    userPosition
      ? `GPS: ${userPosition.lat}, ${userPosition.lng}`
      : "GPS: Not available"
  ].join("\n");

  // Demo-only: record this incident in this page's session.
  console.log("Demo incident report:\n" + details);

  if (map && userPosition) {
    L.circleMarker(
      [userPosition.lat, userPosition.lng],
      {
        radius: 9,
        color: severity === "High" ? "#dc2626" : "#2563eb",
        fillColor: severity === "High" ? "#ef4444" : "#60a5fa",
        fillOpacity: 0.8
      }
    )
      .addTo(map)
      .bindPopup(
        `<strong>${type} — ${severity}</strong><br>` +
        `${description.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`
      );
  }

  $("reportStatus").textContent =
    `Demo report recorded in this session. Reference: RQ-${Date.now()
      .toString().slice(-6)}. No emergency service has been notified.`;

  $("reportForm").reset();
});

// ---------- Nearby hospital search ----------

$("hospitalBtn").addEventListener("click", () => {
  let url;

  if (userPosition) {
    const { lat, lng } = userPosition;
    // Open a search centered near the current device location.
    url =
      `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}` +
      `#map=14/${lat}/${lng}`;
    $("hospitalStatus").textContent =
      "Opening the map near your location. Search for hospitals and verify availability.";
  } else {
    url =
      "https://www.openstreetmap.org/search?query=hospitals";
    $("hospitalStatus").textContent =
      "GPS is unavailable. Opening a general hospital map search.";
  }

  const link = $("hospitalLink");
  link.href = url;
  link.hidden = false;
  window.open(url, "_blank", "noopener,noreferrer");
});
