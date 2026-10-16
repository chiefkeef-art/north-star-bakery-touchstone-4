/* =========================================================================
   North Star Bakery - interactivity for all four pages

   1. Pre-order list: visitors add items from the Products page (or the
      featured cookie on the Home page), change quantities and see an
      estimated total. The list follows them to the Contact page, where it
      fills in the pre-order form.
   2. Category filter on the Products page.
   3. JavaScript validation for the pre-order form, with messages next to
      each field.
   4. localStorage remembers the list, the last category filter and, if the
      visitor opts in, their name and email.
   ========================================================================= */

"use strict";

/* ---------- Data ---------- */

// Every item a customer can add to a pre-order. Prices are the lowest price
// for each item, so totals for "from" items are shown as estimates.
const PRODUCTS = [
  { id: "signature-loaf", name: "Signature Loaf", category: "breads", price: 9 },
  { id: "classic-sourdough", name: "Classic Sourdough", category: "breads", price: 8 },
  { id: "seeded-multigrain", name: "Seeded Multigrain", category: "breads", price: 9 },
  { id: "honey-wheat", name: "Honey Wheat Sandwich Loaf", category: "breads", price: 7 },
  { id: "baguette", name: "Baguette", category: "breads", price: 4 },
  { id: "focaccia", name: "Rosemary Sea Salt Focaccia", category: "breads", price: 6, from: true },
  { id: "butter-croissant", name: "Butter Croissant", category: "pastries", price: 4 },
  { id: "almond-croissant", name: "Almond Croissant", category: "pastries", price: 5 },
  { id: "cinnamon-roll", name: "Cinnamon Roll", category: "pastries", price: 4.5 },
  { id: "fruit-danish", name: "Seasonal Fruit Danish", category: "pastries", price: 5 },
  { id: "pastry-box", name: "Assorted Pastry Box (12)", category: "pastries", price: 42 },
  { id: "cake-6-inch", name: "6-inch Celebration Cake", category: "cakes", price: 28, from: true },
  { id: "cake-9-inch", name: "9-inch Layer Cake", category: "cakes", price: 45, from: true },
  { id: "cake-half-sheet", name: "Half Sheet Cake", category: "cakes", price: 70, from: true },
  { id: "brown-butter-cookie", name: "Brown Butter Chocolate Chunk Cookie", category: "cookies", price: 3 },
  { id: "oatmeal-cookie", name: "Oatmeal Cranberry Cookie", category: "cookies", price: 2.5 },
  { id: "lemon-bar", name: "Lemon Bar", category: "cookies", price: 4 }
];

// Buttons for the Products page filter, in the order they appear.
const CATEGORIES = [
  { id: "all", label: "All products" },
  { id: "breads", label: "Breads" },
  { id: "pastries", label: "Pastries" },
  { id: "cakes", label: "Cakes" },
  { id: "cookies", label: "Cookies and treats" }
];

// Names used for each piece of saved data in localStorage.
const STORAGE_KEYS = {
  list: "northStarBakery.preorderList",
  filter: "northStarBakery.productFilter",
  customer: "northStarBakery.customer"
};

// How many days of notice each kind of order needs.
const NOTICE_DAYS = { "pre-order": 2, "cake-or-event": 7 };
const MAX_DAYS_AHEAD = 60;
const MAX_QUANTITY = 24;
const MONDAY = 1; // the bakery is closed on Mondays

/* ---------- localStorage helpers ---------- */

// Storage can be blocked (for example in some private windows), so every
// read and write is wrapped and the site keeps working without it.
function loadData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Storage unavailable: the page still works for this visit.
  }
}

function removeData(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // Nothing to remove.
  }
}

/* ---------- Pre-order list logic ---------- */

function findProduct(id) {
  return PRODUCTS.find((product) => product.id === id);
}

// The saved list is an array of { id, qty } objects. Entries that no longer
// match a product are dropped, so old or edited data cannot break the page.
function getList() {
  const saved = loadData(STORAGE_KEYS.list, []);
  if (!Array.isArray(saved)) {
    return [];
  }
  return saved.filter((entry) => findProduct(entry.id) && Number.isInteger(entry.qty) && entry.qty > 0);
}

function saveList(list) {
  if (list.length > 0) {
    saveData(STORAGE_KEYS.list, list);
  } else {
    removeData(STORAGE_KEYS.list);
  }
}

function addToList(id) {
  const list = getList();
  const entry = list.find((item) => item.id === id);
  if (!entry) {
    list.push({ id: id, qty: 1 });
  } else if (entry.qty < MAX_QUANTITY) {
    entry.qty += 1;
  }
  saveList(list);
}

function changeQuantity(id, change) {
  const list = getList()
    .map((item) => (item.id === id ? { id: item.id, qty: Math.min(item.qty + change, MAX_QUANTITY) } : item))
    .filter((item) => item.qty > 0);
  saveList(list);
}

function removeFromList(id) {
  saveList(getList().filter((item) => item.id !== id));
}

function countItems(list) {
  return list.reduce((total, item) => total + item.qty, 0);
}

function estimateTotal(list) {
  return list.reduce((total, item) => total + findProduct(item.id).price * item.qty, 0);
}

function formatPrice(amount) {
  return "$" + amount.toFixed(2);
}

function describeTotal(list) {
  const hasFromPrices = list.some((item) => findProduct(item.id).from);
  return (hasFromPrices ? "Estimated total, from " : "Estimated total: ") + formatPrice(estimateTotal(list));
}

function itemWord(count) {
  return count === 1 ? "1 item" : count + " items";
}

// Plain-text version of the list for the form's "Item details" box.
function listToText(list) {
  const lines = list.map((item) => item.qty + " x " + findProduct(item.id).name);
  return "Pre-order list:\n" + lines.join("\n");
}

/* ---------- Rendering the list ---------- */

// Redraws every part of the page that shows the list.
function refreshList() {
  const list = getList();
  renderListBar(list);
  renderPreorderPanel(list);
  updateAddButtons(list);
}

// Brown bar under the header on every page: the list follows the visitor.
function renderListBar(list) {
  const bar = document.getElementById("list-bar");
  if (!bar) {
    return;
  }
  bar.textContent = "";
  if (list.length === 0) {
    bar.hidden = true;
    return;
  }

  const summary = document.createElement("p");
  summary.textContent = "Your pre-order list: " + itemWord(countItems(list)) + ", " +
    describeTotal(list).charAt(0).toLowerCase() + describeTotal(list).slice(1) + ".";
  bar.appendChild(summary);

  if (document.getElementById("preorder-form")) {
    const note = document.createElement("p");
    note.textContent = "It has been added to the form below.";
    bar.appendChild(note);
  } else {
    const onProducts = Boolean(document.getElementById("preorder-panel"));
    bar.appendChild(makeLink(onProducts ? "#preorder-panel" : "products.html#preorder-panel", "View list", ""));
    bar.appendChild(makeLink("contact.html", "Send pre-order", "button"));
  }
  bar.hidden = false;
}

function makeLink(href, text, className) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = text;
  if (className) {
    link.className = className;
  }
  return link;
}

// The "Your Pre-Order List" panel on the Products page.
function renderPreorderPanel(list) {
  const items = document.getElementById("preorder-items");
  if (!items) {
    return;
  }
  const empty = list.length === 0;
  document.getElementById("preorder-empty").hidden = !empty;
  document.getElementById("preorder-actions").hidden = empty;
  document.getElementById("preorder-total").textContent = empty ? "" : describeTotal(list);

  items.textContent = "";
  list.forEach((item) => items.appendChild(makeListRow(item)));
}

function makeListRow(item) {
  const product = findProduct(item.id);
  const row = document.createElement("li");
  row.className = "preorder-item";

  const name = document.createElement("span");
  name.className = "item-name";
  name.textContent = product.name;

  const controls = document.createElement("span");
  controls.className = "qty-controls";
  const quantity = document.createElement("span");
  quantity.className = "qty";
  quantity.textContent = item.qty;
  controls.append(
    makeListButton("decrease", item.id, "−", "Remove one " + product.name, "qty-button"),
    quantity,
    makeListButton("increase", item.id, "+", "Add one more " + product.name, "qty-button")
  );

  const lineTotal = document.createElement("span");
  lineTotal.className = "line-total";
  lineTotal.textContent = (product.from ? "from " : "") + formatPrice(product.price * item.qty);

  const remove = makeListButton("remove", item.id, "Remove", "Remove " + product.name + " from your list", "link-button");

  row.append(name, controls, lineTotal, remove);
  return row;
}

function makeListButton(action, id, text, label, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.action = action;
  button.dataset.id = id;
  button.textContent = text;
  button.setAttribute("aria-label", label);
  return button;
}

// One click handler for every button in the list (event delegation).
function handleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const actions = {
    increase: () => changeQuantity(button.dataset.id, 1),
    decrease: () => changeQuantity(button.dataset.id, -1),
    remove: () => removeFromList(button.dataset.id)
  };
  actions[button.dataset.action]();
  refreshList();
}

function handleClearList() {
  if (window.confirm("Remove every item from your pre-order list?")) {
    saveList([]);
    refreshList();
  }
}

/* ---------- "Add to pre-order list" buttons ---------- */

// Adds a button to every element marked with data-product in the HTML.
function renderAddButtons() {
  document.querySelectorAll("[data-product]").forEach((element) => {
    const product = findProduct(element.dataset.product);
    if (!product) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-outline add-button";
    button.dataset.id = product.id;
    button.addEventListener("click", () => {
      addToList(product.id);
      refreshList();
    });
    element.appendChild(button);
  });
}

// Each button shows how many of that item are already in the list.
function updateAddButtons(list) {
  document.querySelectorAll(".add-button").forEach((button) => {
    const product = findProduct(button.dataset.id);
    const entry = list.find((item) => item.id === product.id);
    button.classList.toggle("in-list", Boolean(entry));
    button.textContent = entry ? "In your list: " + entry.qty + " (add one more)" : "Add to pre-order list";
    button.setAttribute("aria-label", entry
      ? "Add one more " + product.name + ". " + entry.qty + " in your list."
      : "Add " + product.name + " to your pre-order list");
  });
}

/* ---------- Products page: category filter ---------- */

function renderFilterBar() {
  const bar = document.getElementById("filter-bar");
  if (!bar) {
    return;
  }
  CATEGORIES.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-button";
    button.dataset.filter = category.id;
    button.textContent = category.label;
    button.addEventListener("click", () => {
      applyFilter(category.id);
      saveData(STORAGE_KEYS.filter, category.id);
    });
    bar.appendChild(button);
  });
  bar.hidden = false;

  // Reopen the page on the category the visitor chose last time.
  const saved = loadData(STORAGE_KEYS.filter, "all");
  applyFilter(CATEGORIES.some((category) => category.id === saved) ? saved : "all");
}

function applyFilter(categoryId) {
  document.querySelectorAll("section[data-category]").forEach((section) => {
    section.hidden = categoryId !== "all" && section.dataset.category !== categoryId;
  });
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.filter === categoryId));
  });

  const shown = PRODUCTS.filter((product) => categoryId === "all" || product.category === categoryId);
  const category = CATEGORIES.find((item) => item.id === categoryId);
  document.getElementById("filter-status").textContent = categoryId === "all"
    ? "Showing all " + shown.length + " products."
    : "Showing " + shown.length + " " + category.label.toLowerCase() + ".";
}

function setUpPreorderPanel() {
  const panel = document.getElementById("preorder-panel");
  if (!panel) {
    return;
  }
  panel.hidden = false;
  document.getElementById("preorder-items").addEventListener("click", handleListClick);
  document.getElementById("clear-list").addEventListener("click", handleClearList);
}

/* ---------- Contact page: dates ---------- */

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// "2026-10-24" from a date input, read as a local date (not UTC).
function parseInputDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toInputDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + month + "-" + day;
}

function formatLongDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function daysFromToday(date) {
  return Math.round((date - startOfToday()) / (24 * 60 * 60 * 1000));
}

/* ---------- Contact page: validation ---------- */

// One rule per field. Each rule returns an error message, or "" when the
// value is fine. `values` holds every field's current value.
const FORM_RULES = {
  name(value) {
    if (value === "") {
      return "Please enter your full name.";
    }
    if (value.length < 2) {
      return "Your name needs at least 2 characters.";
    }
    if (!/^[\p{L}][\p{L} .'-]*$/u.test(value)) {
      return "Use letters, spaces, hyphens or apostrophes only.";
    }
    return "";
  },
  email(value) {
    if (value === "") {
      return "Please enter your email address so we can confirm your order.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      return "Enter an email address like name@example.com.";
    }
    return "";
  },
  phone(value) {
    if (value !== "" && !/^\d{3}-\d{3}-\d{4}$/.test(value)) {
      return "Use the format 651-555-0123, or leave this field blank.";
    }
    return "";
  },
  request_type(value) {
    return value === "" ? "Choose the kind of request: pre-order, custom cake or event order, or general question." : "";
  },
  pickup_date(value, values) {
    const notice = NOTICE_DAYS[values.request_type];
    if (value === "") {
      return notice ? "Choose a pickup date for your order." : "";
    }
    const date = parseInputDate(value);
    const days = daysFromToday(date);
    if (notice && days < notice) {
      const earliest = formatLongDate(addDays(startOfToday(), notice));
      return (notice === 7 ? "Cakes and event orders need one week's notice." : "Pre-orders need 48 hours' notice.") +
        " Choose " + earliest + " or later.";
    }
    if (days < 0) {
      return "That date has already passed. Choose an upcoming date.";
    }
    if (days > MAX_DAYS_AHEAD) {
      return "We take orders up to " + MAX_DAYS_AHEAD + " days ahead. Choose an earlier date.";
    }
    if (date.getDay() === MONDAY) {
      return "We are closed on Mondays. Please choose another day.";
    }
    return "";
  },
  details(value) {
    if (value === "") {
      return "Tell us what you would like to order or ask.";
    }
    if (value.length < 10) {
      return "Please add a little more detail (at least 10 characters, you have " + value.length + ").";
    }
    if (value.length > 600) {
      return "Please shorten this to 600 characters or fewer.";
    }
    return "";
  },
  allergies(value) {
    return value.length > 300 ? "Please keep allergy notes to 300 characters or fewer." : "";
  }
};

function getFormValues(form) {
  const values = {};
  Object.keys(FORM_RULES).forEach((name) => {
    values[name] = form.elements[name].value.trim();
  });
  return values;
}

// Shows or clears the message next to one field. Returns true when valid.
function validateField(form, name) {
  const values = getFormValues(form);
  const message = FORM_RULES[name](values[name], values);
  const errorBox = document.getElementById("error-" + name);
  errorBox.textContent = message;

  // Radio buttons come back as a list; mark every option in the group.
  const field = form.elements[name];
  const inputs = field instanceof RadioNodeList ? Array.from(field) : [field];
  inputs.forEach((input) => {
    if (message) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  });
  return message === "";
}

// Checks every field and returns the names of the ones that need fixing.
function validateForm(form) {
  return Object.keys(FORM_RULES).filter((name) => !validateField(form, name));
}

function focusField(form, name) {
  const field = form.elements[name];
  const target = field instanceof RadioNodeList ? field[0] : field;
  target.focus();
}

// Greys out dates in the date picker that are too soon for the request type.
function setEarliestPickup(form) {
  const notice = NOTICE_DAYS[form.elements.request_type.value] || NOTICE_DAYS["pre-order"];
  form.elements.pickup_date.min = toInputDate(addDays(startOfToday(), notice));
}

function updateCharCount(form) {
  const count = document.getElementById("details-count");
  count.textContent = form.elements.details.value.length + " of 600 characters";
}

/* ---------- Contact page: saved list and remembered details ---------- */

function fillFromList(form) {
  const list = getList();
  const summary = document.getElementById("order-summary");
  if (list.length === 0) {
    summary.hidden = true;
    return;
  }

  const items = document.getElementById("order-summary-items");
  items.textContent = "";
  list.forEach((item) => {
    const row = document.createElement("li");
    row.textContent = item.qty + " x " + findProduct(item.id).name;
    items.appendChild(row);
  });
  document.getElementById("order-summary-total").textContent = describeTotal(list) + " (we confirm the final price when we reply).";
  summary.hidden = false;

  // Pre-fill the form, but never overwrite something the visitor typed.
  if (form.elements.details.value.trim() === "") {
    form.elements.details.value = listToText(list);
  }
  if (form.elements.request_type.value === "") {
    const hasCake = list.some((item) => findProduct(item.id).category === "cakes");
    form.elements.request_type.value = hasCake ? "cake-or-event" : "pre-order";
  }
  updateCharCount(form);
}

function loadCustomer(form) {
  const customer = loadData(STORAGE_KEYS.customer, null);
  if (customer && typeof customer.name === "string" && typeof customer.email === "string") {
    form.elements.name.value = customer.name;
    form.elements.email.value = customer.email;
    form.elements.remember.checked = true;
  }
}

function saveOrForgetCustomer(form, values) {
  if (form.elements.remember.checked) {
    saveData(STORAGE_KEYS.customer, { name: values.name, email: values.email });
  } else {
    removeData(STORAGE_KEYS.customer);
  }
}

/* ---------- Contact page: submitting ---------- */

function handleSubmit(event) {
  event.preventDefault(); // the bakery has no server yet, so nothing is sent
  const form = event.target;
  const status = document.getElementById("form-status");
  form.dataset.submitted = "true"; // from now on, fields are re-checked as the visitor types
  const invalid = validateForm(form);

  if (invalid.length > 0) {
    status.className = "form-status form-status-error";
    status.textContent = "Please fix the " + (invalid.length === 1 ? "highlighted field" : invalid.length + " highlighted fields") +
      " above. Everything you typed is still here.";
    focusField(form, invalid[0]);
    return;
  }

  const values = getFormValues(form);
  saveOrForgetCustomer(form, values);
  showConfirmation(form, status, values);
}

function showConfirmation(form, status, values) {
  const firstName = values.name.split(" ")[0];
  const when = values.pickup_date ? " for pickup on " + formatLongDate(parseInputDate(values.pickup_date)) : "";
  status.className = "form-status form-status-success";
  status.textContent = "Thank you, " + firstName + "! We received your request" + when +
    " and will reply to " + values.email + " within one business day.";

  // The order has been handed over, so start fresh, keeping remembered details.
  saveList([]);
  refreshList();
  form.reset();
  delete form.dataset.submitted;
  loadCustomer(form);
  fillFromList(form);
  updateCharCount(form);
}

function setUpContactForm() {
  const form = document.getElementById("preorder-form");
  if (!form) {
    return;
  }
  // JavaScript shows its own messages next to each field instead of the
  // browser's pop-ups. Without JavaScript, the HTML validation still works.
  form.noValidate = true;

  const pickup = form.elements.pickup_date;
  pickup.max = toInputDate(addDays(startOfToday(), MAX_DAYS_AHEAD));

  loadCustomer(form);
  fillFromList(form);
  setEarliestPickup(form);
  updateCharCount(form);

  // Text fields are checked when the form is submitted, then live while the
  // visitor types, so a message clears as soon as the entry is fixed. (They
  // are not checked on blur: a message appearing on blur pushed the Send
  // button down mid-click, and the click missed it.)
  ["name", "email", "phone", "details", "allergies"].forEach((name) => {
    form.elements[name].addEventListener("input", () => {
      if (form.dataset.submitted === "true") {
        validateField(form, name);
      }
    });
  });

  // A date is picked in one step, so it is checked right away.
  pickup.addEventListener("change", () => validateField(form, "pickup_date"));

  // The pickup date rule depends on the request type, so a new choice also
  // moves the earliest date in the date picker and re-checks the date.
  Array.from(form.elements.request_type).forEach((radio) => {
    radio.addEventListener("change", () => {
      validateField(form, "request_type");
      setEarliestPickup(form);
      if (pickup.value !== "" || pickup.hasAttribute("aria-invalid")) {
        validateField(form, "pickup_date");
      }
    });
  });

  form.elements.details.addEventListener("input", () => updateCharCount(form));
  form.addEventListener("submit", handleSubmit);
}

/* ---------- Start ---------- */

function initSite() {
  renderAddButtons();
  renderFilterBar();
  setUpPreorderPanel();
  setUpContactForm();
  refreshList();
}

initSite();
