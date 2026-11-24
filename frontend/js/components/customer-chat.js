import { readChat, writeChat } from "../api/chat.js";
import { createAiChat } from "./ai-chat.js";
import {
  node,
  chatError,
  sessionFailed,
  pharmacistAvatar,
  renderChatMessage,
  createChatComposer,
} from "./chat.js";

export function setupCustomerChat() {
  if (document.getElementById("customer-chat-button")) return;
  const style = node("link");
  style.rel = "stylesheet";
  style.href = new URL("../../css/components/chat.css", import.meta.url).href;
  document.head.append(style);
  const trigger = node("button", undefined, "customer-chat-button");
  trigger.id = "customer-chat-button";
  trigger.type = "button";
  trigger.setAttribute("data-auth-background", "");
  trigger.setAttribute("aria-label", "Nhắn tin với dược sĩ");
  trigger.setAttribute("aria-controls", "customer-chat");
  trigger.setAttribute("aria-expanded", "false");
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  const bubble = document.createElementNS(icon.namespaceURI, "path");
  bubble.setAttribute(
    "d",
    "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 3V11.5A8.5 8.5 0 0 1 9.5 3h3a8.5 8.5 0 0 1 8.5 8.5ZM7 9h8M7 13h6",
  );
  icon.append(bubble);
  const badge = node("span", "", "chat-unread");
  badge.hidden = true;
  badge.setAttribute("aria-hidden", "true");
  trigger.append(icon, node("span", "Nhắn tin"), badge);
  const panel = node("section", undefined, "customer-chat");
  panel.id = "customer-chat";
  panel.hidden = true;
  panel.setAttribute("data-auth-background", "");
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-labelledby", "customer-chat-title");
  const header = node("header"),
    title = node("h2", "Tư vấn cùng dược sĩ");
  title.id = "customer-chat-title";
  const close = node("button", "×", "chat-close");
  close.type = "button";
  close.setAttribute("aria-label", "Đóng trò chuyện");
  header.append(pharmacistAvatar(), title, close);
  const state = node("p", "", "chat-status");
  state.setAttribute("role", "status");
  const older = node("button", "Xem tin nhắn cũ", "quiet-link");
  older.type = "button";
  older.hidden = true;
  const messages = node("div", undefined, "chat-log");
  messages.setAttribute("role", "log");
  messages.setAttribute("aria-label", "Tin nhắn với dược sĩ");
  messages.setAttribute("aria-live", "off");
  messages.tabIndex = 0;
  const retry = node("button", "Thử lại", "quiet-link");
  retry.type = "button";
  retry.hidden = true;
  let user,
    generation = 0,
    timer,
    disposed = false,
    loading = false,
    productRequest,
    productBusy = false,
    aiMode = false;
  const items = new Map(),
    owner = () => String(user?.MaNguoiDung || ""),
    allowed = () => user?.VaiTro === 0 && !disposed;
  const composer = createChatComposer({
    getOwner: owner,
    getContext: () =>
      allowed() ? { messages: "/messages", images: "/images" } : null,
    onSent: () => load(),
    onError: failure,
  });
  const modes = node('div', undefined, 'chat-modes');
  modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Chọn người trò chuyện');
  const aiButton = node('button', 'Chat với AI'), pharmacistButton = node('button', 'Chat với dược sĩ');
  for (const button of [aiButton, pharmacistButton]) button.type = 'button';
  modes.append(aiButton, pharmacistButton);
  const ai = createAiChat({ getOwner: owner, onConsult: product => { selectMode(false); open(product); }, onError: failure });
  aiButton.addEventListener('click', () => selectMode(true));
  pharmacistButton.addEventListener('click', () => selectMode(false));
  function selectMode(value) {
    aiMode = value;
    ai.element.hidden = !value;
    for (const element of [state, retry, older, messages, composer.element]) element.hidden = value;
    if (!value) { older.hidden = true; retry.hidden = true; }
    aiButton.setAttribute('aria-pressed', String(value));
    pharmacistButton.setAttribute('aria-pressed', String(!value));
    title.textContent = value ? 'Trợ lý AI Lan Yến' : 'Tư vấn cùng dược sĩ';
    if (value) ai.load(); else load();
  }
  ai.element.hidden = true;
  aiButton.setAttribute('aria-pressed', 'false'); pharmacistButton.setAttribute('aria-pressed', 'true');
  panel.append(header, modes, state, retry, older, messages, composer.element, ai.element);
  document.body.append(trigger, panel);
  function failure(error) {
    state.textContent = chatError(error);
    if (sessionFailed(error)) receive(null);
  }
  function schedule() {
    clearTimeout(timer);
    if (allowed()) timer = setTimeout(refresh, 5000);
  }
  async function refresh() {
    if (!allowed() || document.hidden) {
      schedule();
      return;
    }
    const attempt = generation;
    try {
      const result = await readChat("/unread");
      if (attempt !== generation || !allowed()) return;
      badge.hidden = result.count === 0;
      badge.textContent = String(result.count);
      trigger.setAttribute(
        "aria-label",
        result.count
          ? `Nhắn tin với dược sĩ, ${result.count} tin chưa đọc`
          : "Nhắn tin với dược sĩ",
      );
      if (!panel.hidden && !aiMode) await load();
    } catch (error) {
      if (attempt === generation) {
        failure(error);
        if (allowed()) {
          badge.hidden = false;
          badge.textContent = "?";
          trigger.setAttribute("aria-label", "Chưa tải được số tin chưa đọc");
        }
      }
    } finally {
      if (attempt === generation) schedule();
    }
  }
  async function load(before) {
    if (!allowed() || panel.hidden || aiMode || loading) return;
    loading = true;
    const attempt = generation;
    try {
      const data = await readChat(
        `/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`,
      );
      if (attempt !== generation || !allowed() || aiMode) return;
      const nearBottom =
          messages.scrollHeight - messages.scrollTop - messages.clientHeight <
          80,
        height = messages.scrollHeight,
        top = messages.scrollTop;
      const lastKnown = [...items.keys()].reduce(
        (last, id) => (BigInt(id) > BigInt(last) ? id : last),
        "0",
      );
      // After a long absence, start with a continuous latest page so the
      // older-message cursor can recover every message in between.
      if (
        !before &&
        data.has_more &&
        data.items.length &&
        lastKnown !== "0" &&
        BigInt(data.items[0].id) > BigInt(lastKnown)
      )
        items.clear();
      for (const item of data.items) items.set(item.id, item);
      if (before || items.size <= 50) older.hidden = !data.has_more;
      const sorted = [...items.values()].sort((a, b) =>
        BigInt(a.id) < BigInt(b.id) ? -1 : 1,
      );
      messages.replaceChildren(
        ...sorted.map((item) =>
          renderChatMessage(item, {
            customer: true,
            getOwner: owner,
            onError: failure,
          }),
        ),
      );
      messages.scrollTop = before
        ? top + messages.scrollHeight - height
        : nearBottom
          ? messages.scrollHeight
          : top;
      state.textContent = sorted.length
        ? "Dược sĩ sẽ tiếp nhận và tư vấn cho bạn."
        : "Gửi tin nhắn để bắt đầu tư vấn với dược sĩ.";
      retry.hidden = true;
      if (
        sorted.length &&
        data.items.some((item) => item.role === 1 && !item.read) &&
        !document.hidden &&
        document.hasFocus() &&
        !panel.hidden
      ) {
        await writeChat("/read", { last_id: sorted.at(-1).id }, owner());
        if (attempt === generation) {
          badge.hidden = true;
          trigger.setAttribute("aria-label", "Nhắn tin với dược sĩ");
        }
      }
    } catch (error) {
      if (attempt === generation) {
        failure(error);
        retry.hidden = false;
      }
    } finally {
      if (attempt === generation) loading = false;
    }
  }
  async function sendProduct() {
    if (!productRequest || productBusy || !allowed()) return;
    productBusy = true;
    const attempt = generation;
    try {
      await writeChat("/messages", productRequest, owner());
      if (attempt === generation) {
        productRequest = null;
        retry.hidden = true;
        await load();
      }
    } catch (error) {
      if (attempt === generation) {
        failure(error);
        retry.hidden = false;
      }
    } finally {
      if (attempt === generation) productBusy = false;
    }
  }
  function open(product) {
    if (product) selectMode(false);
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    if (product)
      productRequest = {
        kind: "product",
        items: [{ MaThuoc: product.MaThuoc, MaDonGia: product.MaDonGia }],
        request_id: crypto.randomUUID(),
      };
    if (!allowed()) {
      state.textContent = user
        ? "Chỉ tài khoản khách hàng có thể tư vấn tại đây."
        : "Đăng nhập để nhắn tin với dược sĩ.";
      if (!user) document.getElementById("login-button")?.click();
    } else {
      load();
      if (aiMode) ai.load();
      sendProduct();
    }
    close.focus();
  }
  function receive(next) {
    if (
      String(next?.MaNguoiDung || "") !== owner() ||
      !next ||
      next.VaiTro !== 0
    ) {
      generation++;
      loading = productBusy = false;
      items.clear();
      messages.replaceChildren();
      composer.clear();
      ai.clear();
      badge.hidden = true;
      older.hidden = true;
      clearTimeout(timer);
      if (user) productRequest = null;
    }
    user = next;
    composer.setEnabled(allowed());
    ai.setEnabled(allowed());
    trigger.hidden = !!user && user.VaiTro !== 0;
    if (allowed()) {
      if (productRequest) {
        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
      }
      refresh();
      if (!panel.hidden) sendProduct();
    } else {
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    }
  }
  trigger.addEventListener("click", () =>
    panel.hidden ? open() : close.click(),
  );
  close.addEventListener("click", () => {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    trigger.focus();
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close.click();
    }
  });
  retry.addEventListener("click", () =>
    productRequest ? sendProduct() : load(),
  );
  older.addEventListener("click", () =>
    load([...items.keys()].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))[0]),
  );
  window.addEventListener("chat-product", (event) => open(event.detail));
  window.addEventListener("auth-changed", (event) =>
    receive(event.detail?.user || null),
  );
  window.addEventListener("focus", refresh);
  window.addEventListener("pagehide", () => {
    disposed = true;
    receive(null);
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) disposed = false;
  });
}
