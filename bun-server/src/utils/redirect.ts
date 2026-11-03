/**
 * HTML Redirect Body Generator
 * 
 * Creates an HTML page that performs a client-side redirect.
 * This is used for bang redirects to avoid referrer leakage.
 */

export function redirectBody(url: string): string {
  // Validate and normalize the URL
  let normalizedUrl: string;
  try {
    normalizedUrl = new URL(url).href;
  } catch {
    // If URL is invalid, try to use it as-is
    normalizedUrl = url;
  }
  
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="referrer" content="never">
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="refresh" content="0; url=${normalizedUrl}">
<title>Redirecting...</title>
<style>
body {
  background: #131313;
  color: #fff;
  font-family: system-ui, -apple-system, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  margin: 0;
}
</style>
</head>
<body>
<p>Redirecting...</p>
<script>
(function() {
  window.location.replace('${normalizedUrl}');
})();
</script>
</body>
</html>`.replace(/\n/g, "");
}

export default redirectBody;
