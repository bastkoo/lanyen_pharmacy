import { requestOtp, verifyOtp, registerProfile, getSession } from "../api/auth.js";
import { normalizePhone, validOtp, validName } from "../utils/auth-validation.js";

const messages = {
    CONNECTION_FAILED: 'Không thể kết nối máy chủ. Kiểm tra kết nối rồi thử lại.',
    ACCOUNT_LOCKED: 'Tài khoản đã bị khóa. Bạn không thể đăng nhập bằng số này.',
    CSRF_FAILED: 'Phiên bảo mật đã thay đổi. Vui lòng thử lại.',
    AUTH_UNAVAILABLE: 'Dịch vụ OTP chưa sẵn sàng. Kiểm tra Redis và cấu hình máy chủ.',
    DATABASE_UNAVAILABLE: 'Chưa thể truy cập tài khoản. Vui lòng xác thực lại sau.',
    FORBIDDEN: 'Tài khoản chưa được phép truy cập.',
    INVALID_PHONE: 'Nhập số di động Việt Nam hợp lệ.',
    OTP_INVALID: 'Mã OTP chưa đúng. Vui lòng nhập lại.',
    OTP_EXPIRED: 'Mã đã hết hạn hoặc đã dùng. Hãy gửi mã mới.',
    OTP_ATTEMPTS_EXCEEDED: 'Đã nhập sai quá nhiều lần. Hãy gửi mã mới.',
    VERIFICATION_EXPIRED: 'Xác minh đã hết hạn. Vui lòng bắt đầu lại.',
    RATE_LIMITED: 'Có quá nhiều yêu cầu. Vui lòng chờ rồi thử lại.',
    INVALID_REQUEST: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.'
};
export function authMessage(error) { return messages[error.code] || "Chưa thể hoàn tất xác thực. Vui lòng thử lại."; }

export function setupAuthDialog(onAuthenticated) {
    const $ = id => document.getElementById(id);
    const dialog = $("auth-dialog");
    const closeButton = $("close-auth");
    const background = document.querySelectorAll("body > header, body > main, body > footer, body > .skip-link");
    let step = "phone", phone = "", busy = false, generation = 0, resendAt = 0;
    let opener;
    const forms = { phone: $("phone-form"), otp: $("otp-form"), profile: $("profile-form") };
    const inputs = { phone: $("phone"), otp: $("otp"), profile: $("full-name") };

    function status(message = "", error = false) {
        $("auth-status").textContent = message;
        $("auth-status").dataset.error = String(error);
    }
    function fieldError(field, errorId, message) {
        field.setAttribute("aria-invalid", "true");
        $(errorId).textContent = message;
        field.focus();
    }
    function showStep(next) {
        step = next;
        for (const [name, form] of Object.entries(forms)) form.hidden = name !== next;
        const labels = { phone: ["Bước 1 · Số điện thoại", "Nhập số điện thoại để nhận mã xác thực."],
            otp: ["Bước 2 · Xác thực OTP", `Nhập mã xác thực cho ${phone}.`],
            profile: ["Bước 3 · Hoàn tất hồ sơ", "Lần đầu gặp bạn. Hãy cho Lan Yến biết tên của bạn."] };
        $("auth-progress").textContent = labels[next][0];
        $("auth-description").textContent = labels[next][1];
        inputs[next].focus();
    }
    function setBusy(value) {
        busy = value;
        dialog.setAttribute("aria-busy", String(value));
        dialog.querySelectorAll("form button, form input").forEach(control => { control.disabled = value; });
        updateResend();
    }
    function updateResend() {
        const seconds = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
        $("resend-otp").disabled = busy || seconds > 0;
        $("resend-otp").textContent = seconds > 0 ? `Gửi lại sau ${seconds}s` : "Gửi lại mã";
    }
    const timer = setInterval(updateResend, 1000);
    window.addEventListener("pagehide", () => clearInterval(timer), { once: true });

    async function run(task, loading) {
        if (busy) return;
        const attempt = generation;
        setBusy(true);
        status(loading);
        try { await task(() => attempt === generation && dialog.open); }
        catch (error) {
            if (attempt !== generation) return;
            status(authMessage(error), true);
            if (error.code === "CSRF_FAILED") {
                try { await getSession(); } catch (sessionError) {
                    if (sessionError.code !== "UNAUTHENTICATED") status(authMessage(sessionError), true);
                }
            }
            if (["VERIFICATION_EXPIRED", "DATABASE_UNAVAILABLE"].includes(error.code)) {
                showStep("phone");
            }
            if (step === "otp" && error.code === "OTP_INVALID") {
                fieldError(inputs.otp, "otp-error", authMessage(error));
            }
        } finally {
            if (attempt === generation) {
                setBusy(false); closeButton.disabled = false;
                if (dialog.open) inputs[step].focus();
            }
        }
    }

    function acceptResult(result) {
        if (result.code === 'PROFILE_REQUIRED') {
            showStep('profile');
            status('Số điện thoại đã xác thực. Vui lòng bổ sung họ tên trong 5 phút.');
        } else if (result.code === 'AUTHENTICATED') {
            onAuthenticated(result.user);
            dialog.close();
        } else throw new Error('Unexpected authentication response');
    }
    forms.phone.addEventListener("submit", event => {
        event.preventDefault();
        try { phone = normalizePhone(inputs.phone.value); }
        catch (error) { fieldError(inputs.phone, "phone-error", error.message); return; }
        run(async alive => {
            const result = await requestOtp(phone);
            if (!alive()) return;
            resendAt = Date.now() + result.retry_after * 1000;
            showStep("otp");
            status("Mã đã được tạo. Khi chạy thử local, lấy OTP trong terminal Flask. Mã có hiệu lực 5 phút.");
        }, "Đang xác minh và gửi mã OTP…");
    });
    forms.otp.addEventListener("submit", event => {
        event.preventDefault();
        if (!validOtp(inputs.otp.value)) {
            fieldError(inputs.otp, "otp-error", "Vui lòng nhập đủ 6 chữ số OTP."); return;
        }
        run(async alive => {
            closeButton.disabled = true;
            const result = await verifyOtp(phone, inputs.otp.value.trim());
            if (alive()) acceptResult(result);
        }, "Đang kiểm tra mã OTP…");
    });
    forms.profile.addEventListener("submit", event => {
        event.preventDefault();
        if (!validName(inputs.profile.value)) {
            fieldError(inputs.profile, "name-error", "Nhập họ tên từ 1 đến 255 ký tự, không chứa ký tự điều khiển."); return;
        }
        run(async alive => {
            closeButton.disabled = true;
            const result = await registerProfile(inputs.profile.value.trim());
            if (alive()) acceptResult(result);
        }, "Đang hoàn tất hồ sơ…");
    });
    $("resend-otp").addEventListener("click", () => {
        if (Date.now() < resendAt) return;
        run(async alive => {
            const result = await requestOtp(phone);
            if (!alive()) return;
            inputs.otp.value = "";
            resendAt = Date.now() + result.retry_after * 1000;
            status("Đã tạo mã mới. Lấy mã trong terminal Flask khi chạy thử local.");
        }, "Đang gửi lại mã OTP…");
    });
    $("change-phone").addEventListener("click", async () => {
        inputs.otp.value = ""; status(); showStep("phone");
    });
    for (const [name, input] of Object.entries(inputs)) {
        input.addEventListener("input", () => {
            input.removeAttribute("aria-invalid");
            $({ phone: "phone-error", otp: "otp-error", profile: "name-error" }[name]).textContent = "";
        });
    }
    closeButton.addEventListener("click", () => dialog.close());
    document.addEventListener("keydown", event => {
        if (!dialog.open) return;
        if (event.key === "Escape" && !closeButton.disabled) { event.preventDefault(); dialog.close(); }
        if (event.key !== "Tab") return;
        const controls = [...dialog.querySelectorAll("button:not(:disabled), input:not(:disabled), iframe, a[href]")]
            .filter(control => control.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    dialog.addEventListener("cancel", event => { if (closeButton.disabled) event.preventDefault(); });
    dialog.addEventListener("close", () => {
        if (dialog.open) return; // Ignore a queued close event after the dialog reopened.
        background.forEach(element => { element.inert = false; });
        $("auth-backdrop").hidden = true;
        document.body.classList.remove("auth-open");
        generation += 1; setBusy(false); closeButton.disabled = false;
        opener?.focus();
    });
    return function openAuth(source) {
        opener = source; generation += 1; status();
        Object.values(forms).forEach(form => form.reset());
        dialog.querySelectorAll("[aria-invalid]").forEach(input => input.removeAttribute("aria-invalid"));
        ["phone-error", "otp-error", "name-error"].forEach(id => { $(id).textContent = ""; });
        background.forEach(element => { element.inert = true; });
        $("auth-backdrop").hidden = false;
        document.body.classList.add("auth-open");
        dialog.show(); showStep("phone");
    };
}
