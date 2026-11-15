import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentSession, sendMagicLink, signInWithPassword } from "./auth";

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("./supabase", () => ({ supabase: { auth }, hasSupabaseKey: true }));

beforeEach(() => { Object.values(auth).forEach((f) => f.mockReset()); window.history.pushState({}, "", "/"); });

describe("sendMagicLink", () => {
  it("never creates new accounts and returns participants to /auth/callback", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: null });
    await sendMagicLink("  asha@example.org ");
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "asha@example.org",
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
  });
  it("returns coordinators to /coordinator", async () => {
    window.history.pushState({}, "", "/coordinator");
    auth.signInWithOtp.mockResolvedValue({ error: null });
    await sendMagicLink("coord@example.org");
    expect(auth.signInWithOtp.mock.calls[0][0].options.emailRedirectTo).toBe(`${window.location.origin}/coordinator`);
  });
  it("passes Supabase errors on", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: new Error("rate limited") });
    await expect(sendMagicLink("a@example.org")).rejects.toThrow("rate limited");
  });
});

describe("signInWithPassword", () => {
  it("signs in with a trimmed email", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await signInWithPassword(" a@example.org ", "pw");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@example.org", password: "pw" });
  });
  it("gives a friendly message for a wrong password", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    await expect(signInWithPassword("a@example.org", "x")).rejects.toThrow("That email and password don't match our records.");
  });
  it("shows the real reason for anything else", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Failed to fetch" } });
    await expect(signInWithPassword("a@example.org", "x")).rejects.toThrow("Couldn't sign in: Failed to fetch");
  });
});

describe("currentSession", () => {
  it("returns the signed-in email, or null", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { email: "a@example.org" } } } });
    expect(await currentSession()).toBe("a@example.org");
    auth.getSession.mockResolvedValue({ data: { session: null } });
    expect(await currentSession()).toBeNull();
  });
  it("returns null instead of crashing when the check fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    auth.getSession.mockRejectedValue(new Error("offline"));
    expect(await currentSession()).toBeNull();
  });
});
