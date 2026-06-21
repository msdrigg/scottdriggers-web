---
slug: silent-sigpipe-crash-caused-by-bsd-socket
title: Troubleshooting a silent SIGPIPE crash on iOS
authors: msdrigg
tags:
    - projects
    - ios
---

![console header picture](assets/console.png)

Over the past few months I have been working on diagnosing and fixing many of the crashes in my Roku remote app ([Roam](https://apps.apple.com/us/app/roam-a-better-remote-for-roku/id6469834197)).

The app has been mostly stable for about a year now, so the majority of core logic crashes have already been fixed, leaving only unpredictable and obfuscated bugs.

I want to take some time to write about some particularly interesting crashes I've addressed that might be relevant to others troubleshooting iOS or macOS apps.

I'm starting with this `SIGPIPE` crash, but I'm going to write up several of these issues in a series of blog posts over the next several posts. Checkout [/blog](/blog) for updates.

<!-- truncate -->

## Roam crashes silently sometimes when re-entering the foreground on iOS

Sometime at the beginning of this year, my friend started experiencing crashes when she re-opened the Roam app from the background. I never saw this crash on my device, and it didn't happen repeatably. But Roam crashed enough that it was annoying and worth spending some time to fix.

The issue could be reproduced about 60% of the time with the following steps

1. Force-quit the app to ensure it isn't running in the background
2. Re-open the app and wait a few seconds
3. Return to the home screen but leave the app running in the background
4. Wait a few seconds and re-open the app
5. Within 1/4 of a second, the app should close itself again, but appear to stay running in the background.

Re-opening it again will not trigger the crash again unless the app is force-quitted.

## Looking for clues

Even though the issue was repeatable, I could not find any kind of crash record from these events. I looked through all the typical guidance chased down a few leads

-   I checked for jetsam reports, but couldn't find _any_ for Roam.
-   I turned on the settings for `Share iPhone & Watch Analytics` and `Share With App Developers`
-   I captured a sysdiagnose immediately after the event, but nothing in the capture indicated a crash

The sysdiagnose does include a full dump of the system logs, so I looked through and identified a timeline of events potentially pointing to the source of the issue.

```log
>>> MY APP IS OPENED

default	2025-01-25 13:16:11.060118 -0500	runningboardd	com.apple.runningboard	monitor	Calculated state for app<com.msdrigg.roam(95D1E2E9-9609-44D9-A30A-0C4AEA990A0D)>: running-active (role: UserInteractiveFocal) (endowments: <private>)
default	2025-01-25 13:16:11.060132 -0500	runningboardd	com.apple.runningboard	process	[app<com.msdrigg.roam(95D1E2E9-9609-44D9-A30A-0C4AEA990A0D)>:1758] Set jetsam priority to 100 [0] flag[1]
default	2025-01-25 13:16:11.060132 -0500	runningboardd	com.apple.runningboard	ttl	[app<com.msdrigg.roam(95D1E2E9-9609-44D9-A30A-0C4AEA990A0D)>:1758] Resuming task.
default	2025-01-25 13:16:11.060185 -0500	runningboardd	com.apple.runningboard	ttl	[app<com.msdrigg.roam(95D1E2E9-9609-44D9-A30A-0C4AEA990A0D)>:1758] Set darwin role to: UserInteractiveFocal
info	2025-01-25 13:16:11.062002 -0500	CommCenter	com.apple.CommCenter	ul	BundleID: com.msdrigg.roam is a foreground app
...

>>> XPC says something about XPC_ERROR_CONNECTION_INTERRUPTED

    com.apple.mDNSResponder	Default	[R9386->Q40264] Question assigned DNS service 125
default	2025-01-25 13:16:11.067097 -0500	Roam	com.apple.xpc	connection	[0x300b94900] Re-initialization successful; calling out to event handler with XPC_ERROR_CONNECTION_INTERRUPTED
default	2025-01-25 13:16:11.067152 -0500	Roam	com.apple.runningboard	monitor	Received state update for 1758 (app<com.msdrigg.roam(95D1E2E9-9609-44D9-A30A-0C4AEA990A0D)>, unknown-NotVisible
info	2025-01-25 13:16:11.068357 -0500	Roam	com.apple.coreaudio
...

>>> MY APP RUNS AND STARTS LOGGING ON ITS OWN

default	2025-01-25 13:16:11.109376 -0500	Roam	com.msdrigg.roam	ECPWebsocketClient	Clearing handlers
default	2025-01-25 13:16:11.109378 -0500	Roam	com.msdrigg.roam	ECPWebsocketClient	No longer in error b/c restarting
default	2025-01-25 13:16:11.109419 -0500	Roam	com.msdrigg.roam	ECPWebsocketClient	Ignoring state change because it is the same connecting at 2025-01-25 18:16:11 +0000
...

>>> XPC Connection invalidated

default	2025-01-25 13:16:11.146441 -0500	runningboardd	com.apple.runningboard	process	XPC connection invalidated: [app<com.msdrigg.roam(95D1E2E9-9609-44D9-A30A-0C4AEA990A0D)>:1758]
...

>>> Launchd reports app exit

default	2025-01-25 13:16:11.150861 -0500	launchd	user/501/UIKitApplication:com.msdrigg.roam[6159][rb-legacy] [1758]		exited due to SIGPIPE | sent by Roam[1758], ran for 4930203ms
default	2025-01-25 13:16:11.150876 -0500	launchd	user/501/UIKitApplication:com.msdrigg.roam[6159][rb-legacy] [1758]		service state: exited
...
```

Even with this timeline, nothing came up in my google searches for `SIGPIPE` issues or `XPC connection invalidated`. To get to the bottom of the issue, I posted on the apple developer forums with my whole log file describing the crash and the concerns around it.

## Quinn Saves the Day

Within two days, I received a helpful comment from [Quinn “The Eskimo!”](https://developer.apple.com/forums/thread/773205?answerId=822700022#822700022) describing how the `SIGPIPE` signal could lead to a clean exit of my app (an exit without a crash log). Quinn also published a [separate post](https://developer.apple.com/forums/thread/773307) describing what could cause this error and where I should be looking in my app to find the issue.

The root of my problem was the fact that I use BSD sockets to auto-discover Roku TV's on the local network. When I first implemented the ([SSDP Protocol](https://en.wikipedia.org/wiki/Simple_Service_Discovery_Protocol)) for device discovery, I used the more modern and safer `Network` framework. But I had to switch to BSD sockets for because `Network` framework has an [unrelated bug](https://developer.apple.com/forums/thread/716339?page=1#769355022) in it where two apps can conflict with each other and prevent binding on a particular UDP port even if `allowLocalEndpointReuse` is set to `true`.

And as it turns out, when you try to write to a closed BSD socket, the socket helpfully exits your whole app immediately with a SIGPIPE error code. I guess this is what I get for using low level networking primitives without knowing how they work or what the footguns are.

## Fixing the issue

Thankfully, this is an easy problem to fix with a simple [one-line change](https://github.com/msdrigg/Roam/commit/3e51886b4660cc865acd58d66c2a5ff1e6fb4399).

```swift
try socket.setSocketOption(SOL_SOCKET, SO_NOSIGPIPE, 1 as CInt)
```

After investigating the problem I can also explain why I never saw this crash on my device. The device discovery occurred in some code that can be disabled in Roam settings. On my device I had this setting turned off, so it never ran the crashing code path! The investigation also explained why the app only crashed sometimes. The app needed to run this particular code at the right time so the sockets close in the background and then get written to as the app re-enters the foreground.

## Takeaways

This crash was very difficult to troubleshoot because it didn't produce a crash log. Apple's crash reporter is top-notch and provides privacy-friendly opt-in reports for all app crashes, but it does have its limits. This crash was one of those limitations. It never got reported to me because apple's crash reporter does not consider `SIGPIPE` exits as errors, so it does not report them.

I never would have caught it without help from a friend and access to a physically crashing device. To prevent this silent crash and others like it from going unnoticed, I added a few stopgaps so `Roam` is a bit noisier when exiting.

```swift
/// SwiftUI main app initializer
@main
struct RoamApp: App {
    init() {
        Log.lifecycle.notice("Starting Roam")
        #if !os(macOS)
        installAborter()
        #endif
        installSIGPIPEHandler()
    }
}

func installAborter() {
    let atexitResult = atexit({
        Log.lifecycle.error("Aborting due to exit being called")
        abort()
    })
    if atexitResult == 0 {
        Log.lifecycle.notice("Added call to atexit")
    } else {
        Log.lifecycle.error("FAILED to add call to atexit")
    }
}
```

```c
// C helpers
static void sigpipeHandler(int sigNum) {
    __builtin_trap();
}

extern void installSIGPIPEHandler(void) {
    signal(SIGPIPE, sigpipeHandler);
}
```

These additions cause `sigpipeHandler` to run and abort the app when any `SIGPIPE` signals are detected, and they call `atexit` to cause an `abort` when there is any other clean exit. Now I am again dealing with low-level systems that I don't fully understand, so hopefully my hubris is not punished again.

I hope you got some benefit from reading this post. If you want to know ask questions, or have any tips for how to handle any errors like this, check out my [github](https://github.com/msdrigg/roam) where I develop Roam fully in the open.
