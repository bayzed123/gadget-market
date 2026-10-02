// Profile: name, password and two-step sign-in (required for Super Admin and Manager).
import { t, lang } from "../i18n.js";
import { html, api, $, session, toast, msg, errMsg, showErrors, confirmDialog } from "../core.js";

export default async function profile(view) {
  const L = (en, bn) => (lang() === "bn" ? bn : en);
  const me = await api("/auth/me").catch(() => ({ admin: session.admin }));
  const a = me.admin;
  const required = ["super_admin", "manager"].includes(a.role);
  view.innerHTML = String(html`<div class="page-head"><h1>${t("profile")}</h1></div>
    <form class="card" id="pf" style="max-width:560px" novalidate>
      <label class="field"><span>${L("Name", "নাম")}</span><input class="input" name="name" value="${a.name}" required></label>
      <label class="field"><span>${t("loginId")}</span><input class="input" value="${a.email}" disabled></label>
      ${a.phone ? html`<label class="field"><span>${t("phone")}</span><input class="input" value="${a.phone}" disabled></label>` : ""}
      <label class="field"><span>${t("currentPassword")}</span><input class="input" type="password" name="currentPassword" autocomplete="current-password"></label>
      <label class="field"><span>${t("newPassword")}</span><input class="input" type="password" name="newPassword" minlength="10" autocomplete="new-password"></label>
      <button class="btn primary">${t("save")}</button></form>
    <div class="card" style="max-width:560px"><h2>${t("twoFaTitle")}</h2>
      <p>${a.totp_enabled ? html`✓ <b>${L("On", "চালু")}</b> — ${L("you'll be asked for a 6-digit code from your authenticator app when you sign in.", "সাইন ইনের সময় অথেন্টিকেটর অ্যাপের ৬ সংখ্যার কোড চাওয়া হবে।")}` : L("Off. Turning it on protects your account even if someone learns your password.", "বন্ধ। চালু করলে কেউ পাসওয়ার্ড জানলেও অ্যাকাউন্ট সুরক্ষিত থাকে।")}</p>
      ${required ? html`<p class="muted small">${L("Required for your role.", "আপনার রোলের জন্য বাধ্যতামূলক।")}</p>` : a.totp_enabled ? html`<button class="btn" id="tfa-off">${L("Turn off", "বন্ধ করুন")}</button>` : html`<button class="btn primary" id="tfa-on">${L("Turn on", "চালু করুন")}</button>`}
      <div id="tfa-setup"></div></div>`);
  $("#pf", view).addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api("/auth/me", { method: "PUT", body: { name: fd.get("name"), currentPassword: fd.get("currentPassword") || undefined, newPassword: fd.get("newPassword") || undefined } });
      session.admin.name = fd.get("name");
      toast(msg(r));
      e.target.currentPassword.value = e.target.newPassword.value = "";
    } catch (err) { showErrors(e.target, err); toast(errMsg(err), "err"); }
  });
  $("#tfa-off", view)?.addEventListener("click", async () => {
    if (!(await confirmDialog(L("Turn off two-step sign-in?", "দুই-ধাপের সাইন-ইন বন্ধ করবেন?")))) return;
    try { await api("/auth/2fa/disable", { method: "POST" }); toast(t("saved")); profile(view); } catch (err) { toast(errMsg(err), "err"); }
  });
  $("#tfa-on", view)?.addEventListener("click", async () => {
    try {
      const s = await api("/auth/2fa/setup", { method: "POST" });
      $("#tfa-setup", view).innerHTML = String(html`<p>${t("twoFaSetup")}</p><p class="small">${t("twoFaKey")}: <b style="word-break:break-all">${s.secret}</b><br><a href="${s.otpauth}">otpauth://</a></p>
        <form id="tfa"><label class="field"><span>${t("code")}</span><input class="input otp-code" name="code" inputmode="numeric" maxlength="6" required autocomplete="one-time-code"></label><button class="btn primary">${t("confirm")}</button></form>`);
      $("#tfa", view).addEventListener("submit", async (e) => {
        e.preventDefault();
        try { toast(msg(await api("/auth/2fa/enable", { method: "POST", body: { code: e.target.code.value } }))); profile(view); }
        catch (err) { showErrors(e.target, err); toast(errMsg(err), "err"); }
      });
    } catch (err) { toast(errMsg(err), "err"); }
  });
}
