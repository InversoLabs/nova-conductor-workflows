# Mara listening test — September 25, 2026

Public route: /newsroom/voice-test/ . No automatic feedback submission; users copy ratings and notes to return to the organizer.

The same published LiquidAI briefing plus the original introduction and closing is used for A/B/C with af_sarah. A is original segment-level synthesis, extracted losslessly from the original WAV; B uses sentence-level synthesis and explicit pauses; C uses PyKokoro 0.9.10 automatic pauses, Kokoro v1.0 and the same installed model/voice files. All use speed 1.0. Separate export comparison uses the same original performance from the prior video versus the source WAV. WAV outputs are loudness matched to -18 LUFS with -2 dBTP ceiling. Durations may differ. This is a pipeline comparison, not a controlled single-parameter experiment.

Server lab: %LOCALAPPDATA%/NovaConductor/voice-lab . PyKokoro runs in an isolated CPU virtual environment; production voice packages are unchanged. The Python scripts document regeneration. Source metadata and validation JSON remain in the lab, not on the public site.

Export repair: regular newsroom and fakenews preview commands pass --audio voice.wav to their compositors. Final AAC 192k/48k comes directly from the original 24k WAV, bypassing SadTalker's 16k audio and intermediate AAC. This prevents avoidable degradation but does not prove the reported lisp originates in export. Existing published videos are not automatically replaced.

Regression check: a one-second video with 500 Hz audio and separate 9 kHz source WAV was composed in both layouts. Decoded outputs must have their dominant frequency at 9 kHz. Both layouts passed and decoded successfully.

Public files are uniformly encoded AAC 192k/48k in audio-only MP4 for the existing range-enabled media route. Lossless normalized WAV masters remain in the lab. Scripts live in app.js to comply with the site's Content Security Policy. Static deploy directory is newsroom/public/voice-test.

User selected B on 2026-09-25. Production newsroom/anchor/voice.py now uses the tested sentence split, 0.42s sentence pause and 0.25s segment pause, speed 1.0 and original voice. Both regular channels call this shared generator. Nonfinite, empty, silent or clipping waveforms stop generation. Both regular compositors require --audio; they cannot silently use animation audio. Custom specials retain their hand-directed delivery.
