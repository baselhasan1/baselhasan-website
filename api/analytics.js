import { google } from "googleapis";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const propertyId =
    process.env.GOOGLE_ANALYTICS_PROPERTY_ID?.trim() || "";
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim() || "";
  const privateKey =
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim() || "";

  if (!propertyId || !clientEmail || !privateKey) {
    return res.status(500).json({
      error: "Missing analytics environment variables.",
      checks: {
        hasPropertyId: Boolean(propertyId),
        hasClientEmail: Boolean(clientEmail),
        hasPrivateKey: Boolean(privateKey),
      },
      preview: {
        propertyId: propertyId || null,
        clientEmail: clientEmail || null,
        privateKeyStart: privateKey ? privateKey.slice(0, 30) : null,
      },
    });
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });

    const analyticsData = google.analyticsdata({
      version: "v1beta",
      auth,
    });

    const response = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "userEngagementDuration" },
        ],
      },
    });

    const metricValues = response.data.rows?.[0]?.metricValues || [];

    return res.status(200).json({
      visits: Number(metricValues[0]?.value || 0),
      uniqueVisitors: Number(metricValues[1]?.value || 0),
      timeSpentSeconds: Number(metricValues[2]?.value || 0),
    });
  } catch (error) {
    console.error("Analytics API error:", error);

    return res.status(500).json({
      error: error?.message || "Failed to fetch analytics data.",
      details: error?.errors || error?.response?.data || null,
    });
  }
}