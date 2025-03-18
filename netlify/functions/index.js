// Netlify serverless function
export async function handler(event, context) {
  // Handle API requests here
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Hello from Netlify function",
      timestamp: new Date().toISOString()
    }),
    headers: {
      "Content-Type": "application/json"
    }
  };
} 