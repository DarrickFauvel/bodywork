// ── StatusBadge ────────────────────────────────────────────────────────────
class StatusBadge extends HTMLElement {
  static observedAttributes = ["status"]

  connectedCallback() { this.#render() }
  attributeChangedCallback() { this.#render() }

  #render() {
    const s = this.getAttribute("status") || "draft"
    this.innerHTML = `<span class="badge badge-${s}">${s}</span>`
  }
}
customElements.define("status-badge", StatusBadge)

// ── CurrencyAmount ─────────────────────────────────────────────────────────
class CurrencyAmount extends HTMLElement {
  static observedAttributes = ["value"]

  connectedCallback() { this.#render() }
  attributeChangedCallback() { this.#render() }

  #render() {
    const n = parseFloat(this.getAttribute("value") || "0")
    this.textContent = n.toLocaleString("en-US", { style: "currency", currency: "USD" })
  }
}
customElements.define("currency-amount", CurrencyAmount)

// ── CopyButton ─────────────────────────────────────────────────────────────
class CopyButton extends HTMLElement {
  connectedCallback() {
    this.style.cursor = "pointer"
    this.addEventListener("click", async () => {
      const text = this.getAttribute("text") || ""
      await navigator.clipboard.writeText(text)
      const orig = this.textContent
      this.textContent = "Copied!"
      setTimeout(() => { this.textContent = orig }, 1500)
    })
  }
}
customElements.define("copy-button", CopyButton)

// ── ToastMessage ───────────────────────────────────────────────────────────
// Reads the Datastar signal store for a "toast" key and auto-dismisses
class ToastMessage extends HTMLElement {
  #timer = null

  connectedCallback() {
    this.setAttribute("aria-live", "polite")
    // Observe DOM mutations so when Datastar patches signals we can react
    const obs = new MutationObserver(() => this.#check())
    obs.observe(this, { childList: true, subtree: true, characterData: true })
    this.#check()
  }

  #check() {
    const msg = this.getAttribute("message") || this.textContent?.trim()
    if (msg) {
      this.style.display = ""
      clearTimeout(this.#timer)
      this.#timer = setTimeout(() => {
        this.setAttribute("message", "")
        this.textContent = ""
        this.style.display = "none"
      }, 4000)
    } else {
      this.style.display = "none"
    }
  }

  static observedAttributes = ["message"]
  attributeChangedCallback() { this.#check() }
}
customElements.define("toast-message", ToastMessage)

// ── LineItemTypeFields ─────────────────────────────────────────────────────
// Shows the correct set of input fields for the selected line item type.
// Works standalone (no Datastar needed) by listening to a sibling <select>.
class LineItemTypeFields extends HTMLElement {
  #select = null

  connectedCallback() {
    const form = this.closest(".add-item-row") || this.parentElement
    this.#select = form?.querySelector("select[name='newType']")
    if (this.#select) {
      this.#select.addEventListener("change", () => this.#update())
      this.#update()
    }
  }

  #update() {
    const type = this.#select?.value || "labor"
    this.querySelectorAll("[data-for-type]").forEach((el) => {
      const types = el.getAttribute("data-for-type").split(",")
      el.style.display = types.includes(type) ? "" : "none"
    })
  }
}
customElements.define("line-item-type-fields", LineItemTypeFields)

// ── VehicleSummary ─────────────────────────────────────────────────────────
class VehicleSummary extends HTMLElement {
  connectedCallback() { this.#render() }
  static observedAttributes = ["year", "make", "model", "color", "vin", "mileage"]
  attributeChangedCallback() { this.#render() }

  #render() {
    const get = (k) => this.getAttribute(k) || ""
    const year = get("year"), make = get("make"), model = get("model")
    const color = get("color"), vin = get("vin"), mileage = get("mileage")
    const title = [year, make, model].filter(Boolean).join(" ") || "—"
    this.innerHTML = `
      <strong>${title}</strong>
      ${color ? `<span class="text-muted"> · ${color}</span>` : ""}
      ${vin ? `<div class="text-muted" style="font-size:0.78rem;">VIN: ${vin}</div>` : ""}
      ${mileage ? `<div class="text-muted" style="font-size:0.78rem;">${parseInt(mileage).toLocaleString()} mi</div>` : ""}
    `
  }
}
customElements.define("vehicle-summary", VehicleSummary)
