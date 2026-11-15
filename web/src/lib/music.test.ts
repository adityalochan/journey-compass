import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom can't play audio, so play/load/pause are stubbed; the player logic is what's tested.
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});

describe("music player", () => {
  it("switching track starts the next one at once, at normal volume (no fade-in delay)", async () => {
    const m = await import("./music");
    m.toggleMusic();                       // first start: soft fade-in
    await Promise.resolve(); await Promise.resolve();
    const before = m.useMusic;             // keep module alive
    m.next();
    const played = vi.mocked(HTMLMediaElement.prototype.play).mock.contexts.at(-1) as HTMLAudioElement;
    expect(played.volume).toBeCloseTo(0.35);
    expect(played.src).toContain(m.TRACKS[1].src);
    expect(before).toBeDefined();
  });

  it("preloads the following track so the switch doesn't wait for a download", async () => {
    const m = await import("./music");
    m.toggleMusic();
    await vi.waitFor(() => expect(HTMLMediaElement.prototype.load).toHaveBeenCalled());
    const warmed = vi.mocked(HTMLMediaElement.prototype.load).mock.contexts.at(-1) as HTMLAudioElement;
    expect(warmed.src).toContain(m.TRACKS[1].src);
    expect(warmed.preload).toBe("auto");
  });

  it("auto-starts 4 seconds after landing, unless music was turned off", async () => {
    vi.useFakeTimers();
    try {
      await import("./music");
      expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(4000);
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();

      vi.resetModules();
      vi.mocked(HTMLMediaElement.prototype.play).mockClear();
      sessionStorage.setItem("jc-music", "off");
      await import("./music");
      await vi.advanceTimersByTimeAsync(5000);
      expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("an old remembered 'off' no longer blocks autostart on a new visit", async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem("jc-music", "off"); // what older versions saved forever
      await import("./music");
      await vi.advanceTimersByTimeAsync(4000);
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
      expect(localStorage.getItem("jc-music")).toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it("pressing next after pausing turns music back on for later", async () => {
    const m = await import("./music");
    m.toggleMusic(); await Promise.resolve(); await Promise.resolve();
    m.toggleMusic();                                   // pause: off for this visit
    expect(sessionStorage.getItem("jc-music")).toBe("off");
    m.next();
    expect(sessionStorage.getItem("jc-music")).toBeNull();
  });

  it("if the browser blocks autostart, it keeps trying on each click until it plays", async () => {
    vi.useFakeTimers();
    try {
      const play = vi.mocked(HTMLMediaElement.prototype.play);
      play.mockRejectedValueOnce(new Error("NotAllowedError")).mockRejectedValueOnce(new Error("NotAllowedError"));
      const m = await import("./music");
      await vi.advanceTimersByTimeAsync(4000);          // blocked
      document.body.click();                             // still blocked
      await vi.advanceTimersByTimeAsync(0);
      document.body.click();                             // allowed now
      await vi.advanceTimersByTimeAsync(0);
      expect(play).toHaveBeenCalledTimes(3);
      expect(m.useMusic).toBeDefined();
      document.body.click();                             // playing: no further attempts
      await vi.advanceTimersByTimeAsync(0);
      expect(play).toHaveBeenCalledTimes(3);
    } finally { vi.useRealTimers(); }
  });
});
