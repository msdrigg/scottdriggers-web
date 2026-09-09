---
slug: inflight-wifi-cors-preflight
title: Getting back onto in-flight Wi-Fi by disabling CORS
authors: msdrigg
tags:
    - networking
    - debugging
---

I had a flight for work today, and the in-flight Wi-Fi was free, sponsored by T-Mobile ©. Praise be to our corporate sponsors.

About halfway through the flight the connection dropped and wouldn't let me sign back in. Every time I entered my Delta SkyMiles login on the Wi-Fi access page, it came back with a cheerful **"Something's wrong, try again"** and no other information.

<!-- truncate -->

## No error is a kind of error

I really wanted my internet back, so I opened dev tools on the sign-in page and started looking for failing or rejected requests. There were plenty of unhealthy-looking things in the network tab: a few requests were timing out, and some were failing the TLS handshake outright. But none of them told me *why*. No status code, no response body, no rejection reason. Just red rows.

My first theory was a device-based restriction of some kind, so I reset my Wi-Fi MAC address and tried again. Same error. It also clearly wasn't my account, because my phone was on the same portal and logged in without complaining at all.

So it was something about this laptop, on this browser, on this portal.

## Some of these requests aren't blocked, they're just hanging

After clicking "Login" about twenty more times and watching the network tab each round, I noticed something I'd been glossing over: the failing requests weren't being *rejected*. Nothing was returning a 403 or a 429 or an error page. They were just hanging until they timed out.

That's a meaningfully different failure. A rejection is a server telling you no. A hang is a server declining to say anything at all.

So I started pulling requests out of the browser to see how they behaved on their own. Chrome's "Copy as cURL" is perfect for this, because it carries every header and cookie along with it, so you're replaying something very close to what the browser actually sent.

I copied the OAuth2 request first and ran it in a terminal:

```sh
curl 'https://.../oauth2/token' -X POST -H '...' --data '...'
```

It succeeded. Immediately, cleanly, with a real response body. Which was weird, because that's the exact request the page couldn't get through.

Then I did the same thing for the `OPTIONS` request, the CORS preflight that the browser fires before the real POST:

```sh
curl 'https://.../oauth2/token' -X OPTIONS -H 'Origin: ...' -H 'Access-Control-Request-Method: POST' -v
```

The remote server closed the connection before finishing the TLS handshake.

There it is. The preflight was the limiting step. The actual login request was fine the whole time; the browser just never got permission to send it.

## The fix is embarrassingly short

A preflight is a browser thing. `curl` doesn't send one, which is why my hand-run POST sailed through. So if I could convince Chrome not to send one either, the login should work the way it did from my terminal.

```sh
open -na "Google Chrome" --args --disable-web-security --user-data-dir="/tmp/chrome-nocors"
```

That launches a completely separate Chrome instance with same-origin policy turned off. The `--user-data-dir` isn't optional here, it's what forces a new instance with its own profile instead of attaching to your existing one. Chrome won't disable web security in a profile you actually use, and you very much don't want it to.

In that window, the sign-in page skipped the preflight, sent the POST directly, got its token, and logged me in. Internet restored. I spent the rest of the flight closing Jira tickets, which is its own kind of punishment.

## What I think was actually happening

My guess is that the connection reset on `OPTIONS` was a half-hearted attempt at rate-limiting logins, or at kicking sessions off after some threshold. Twenty-odd login attempts is exactly the kind of behavior that would trip something like that.

What I don't understand is why they only did it to the preflight and not to the `POST` as well. Dropping the preflight blocks the browser but leaves the actual credential-accepting endpoint wide open to anything that isn't a browser, which is a strange place to draw the line if you're trying to slow down login attempts. If the goal was rate limiting, this stops normal users and doesn't stop anyone who would actually be a problem.

But I'm not going to look a gift horse in the mouth.

:::warning
Close that Chrome window when you're done, and delete the profile directory. A browser with same-origin policy disabled will happily let any page you visit read from any other origin you're authenticated to. It's a fine tool for poking at one broken captive portal and a terrible thing to leave running.
:::
