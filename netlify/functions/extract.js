// netlify/functions/extract.js

exports.handler = async function(event, context) {
  // CORS Headers taaki tumhari SolidJS app isko bina block hue call kar sake
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  // Agar request options hai (CORS preflight), toh direct 200 bhej do
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "OK" };
  }

  const targetUrl = event.queryStringParameters.url;

  if (!targetUrl) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: "URL parameter missing" })
    };
  }

  try {
    // 1. Target server (jaise vidsrc ya peachify) ko fetch karna
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Referer': targetUrl // Kuch servers bina referer ke block kar dete hain
      }
    });

    const html = await response.text();

    // 2. Smart Regex: HTML ya JavaScript ke andar se .m3u8 ya .mp4 link dhoondhna
    // Yeh regex typical video file URLs ko catch karti hai jo single/double quotes ke andar hote hain
    const streamRegex = /(https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*)/i;
    const match = html.match(streamRegex);

    if (match && match[1]) {
      // 3. Agar clean link mil gaya, toh success response bhejo
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          streamUrl: match[1] 
        })
      };
    }

    // Agar regex se link nahi mila (kuch servers heavy encryption use karte hain)
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ success: false, error: "Could not find direct stream link in the source code." })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
