const fs = require("fs");
const https = require("https");

const ALLOWED_CHANNELS = new Set(["sfm", "mfm"]);
const PORT = 3689;

const options = {
    cert: fs.readFileSync("/etc/letsencrypt/live/cantabile.tplinkdns.com/fullchain.pem"),
    key: fs.readFileSync("/etc/letsencrypt/live/cantabile.tplinkdns.com/privkey.pem"),
};

https.createServer(options, (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }

    const url = new URL(req.url, `https://localhost:${PORT}`);
    const channel = url.searchParams.get("channel");

    if (!channel || !ALLOWED_CHANNELS.has(channel)) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        return res.end("Invalid channel");
    }

    const apiUrl = `https://sminiplay.imbc.com/aacplay.ashx?agent=webapp&channel=${channel}`;

    https.get(apiUrl, (apiRes) => {
        let data = "";
        apiRes.on("data", (chunk) => data += chunk);
        apiRes.on("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end(data.trim());
        });
    }).on("error", () => {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Failed to fetch MBC stream URL");
    });
}).listen(PORT, () => {
    console.log(`MBC proxy running on https://localhost:${PORT}`);
});
