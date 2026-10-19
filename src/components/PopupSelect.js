import { defineComponent, h, ref, nextTick, Teleport, onBeforeUnmount, useId } from "vue";

export default defineComponent({
  name: "PopupSelect",
  inheritAttrs: false,
  props: {
    modelValue: { default: undefined },
    value: { default: undefined },
    modelModifiers: { default: () => ({}) },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { attrs, slots, emit }) {
    const open = ref(false);
    const trigger = ref(null);
    const popup = ref(null);
    const position = ref({});
    const id = `popup-select-${useId()}`;
    let options = [];
    let search = "";
    let searchTimer;
    const text = (children) => Array.isArray(children)
      ? children.map(node => typeof node === "object" ? text(node.children) : String(node ?? "")).join("")
      : typeof children === "string" || typeof children === "number" ? String(children) : "";
    function collect(nodes) {
      return (nodes || []).flatMap(node => {
        if (node.type === "option") {
          const label = text(node.children).trim().replace(/\s+/g, " ");
          return [{ label, value: node.props && "value" in node.props ? node.props.value : label,
            disabled: node.props?.disabled !== undefined && node.props.disabled !== false }];
        }
        return Array.isArray(node.children) ? collect(node.children) : [];
      });
    }
    function close(restore = false) {
      open.value = false;
      if (restore) trigger.value?.focus();
    }
    const current = () => props.modelValue !== undefined ? props.modelValue : props.value;
    function place() {
      if (!trigger.value || !popup.value) return;
      const rect = trigger.value.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 192), 320, window.innerWidth - 16);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const up = below < 180 && above > below;
      const height = Math.min(300, Math.max(80, up ? above : below));
      position.value = { width: `${width}px`, maxHeight: `${height}px`,
        left: `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`,
        ...(up ? { bottom: `${window.innerHeight - rect.top + 6}px` } : { top: `${rect.bottom + 6}px` }) };
    }
    async function show(last = false) {
      if (trigger.value?.matches(":disabled")) return;
      open.value = true;
      await nextTick();
      place();
      await nextTick();
      const buttons = popup.value?.querySelectorAll("button:not(:disabled)");
      const selected = popup.value?.querySelector('[aria-selected="true"]:not(:disabled)');
      (selected || (last ? buttons?.[buttons.length - 1] : buttons?.[0]))?.focus();
    }
    function choose(option) {
      emit("update:modelValue", option.value);
      emit("change", { target: { value: option.value } });
      close(true);
    }
    function keydown(event) {
      const buttons = [...(popup.value?.querySelectorAll("button:not(:disabled)") || [])];
      const index = buttons.indexOf(document.activeElement);
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
      else if (event.key === "Tab") close();
      else if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
          : (index + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        search += event.key.toLocaleLowerCase();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { search = ""; }, 600);
        buttons.find(button => button.textContent.toLocaleLowerCase().startsWith(search))?.focus();
      }
    }
    function outside(event) {
      if (!trigger.value?.contains(event.target) && !popup.value?.contains(event.target)) close();
    }
    function scroll(event) {
      if (!popup.value?.contains(event.target)) close();
    }
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", scroll, true);
    onBeforeUnmount(() => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", scroll, true);
      clearTimeout(searchTimer);
    });
    return () => {
      options = collect(slots.default?.());
      const selected = options.find(option => Object.is(option.value, current()));
      const compact = options.every(option => option.label.length <= 5);
      return h("span", { class: "popup-select" }, [
        h("button", { ...attrs, ref: trigger, type: "button", class: ["popup-select-trigger", attrs.class],
          "aria-haspopup": "listbox", "aria-expanded": open.value, "aria-controls": id,
          onClick: () => open.value ? close() : show(),
          onKeydown: event => {
            if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); show(event.key === "ArrowUp"); }
          } }, selected?.label || "Choisir"),
        open.value ? h(Teleport, { to: "body" }, h("div", {
          id, ref: popup, role: "listbox", class: ["popup-select-menu", { "popup-select-menu-grid": compact }],
          style: position.value, "aria-label": attrs["aria-label"] || "Choisir une option", onKeydown: keydown,
        }, options.map((option, index) => h("button", {
          key: index, type: "button", role: "option", disabled: option.disabled,
          "aria-selected": Object.is(option.value, current()), onClick: () => choose(option),
        }, option.label)))) : null,
      ]);
    };
  },
});
