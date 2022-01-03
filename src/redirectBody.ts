export default function RedirectBody(url: string) {
  return `<html>
<head><meta http-equiv='Content-Type' content='text/html; charset=utf-8'><meta name='referrer' content='never'><meta name='robots' content='noindex, nofollow'>
<meta http-equiv='refresh' content='0; url=${new URL(url).href}'>
</head><body style="background:#131313">
<script language='JavaScript'>
function ffredirect(){
    window.location.replace('${new URL(url).href}');
}
setTimeout('ffredirect()',100);
</script></body></html>`.replace(/\n/g, '');
}
