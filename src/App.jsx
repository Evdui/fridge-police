
import { useEffect, useState } from "react";
import "./App.css";

const PEOPLE = ["Alex", "Jordan", "Casey", "Sam"];
const DAY = 24 * 60 * 60 * 1000;

function createInitialItems() {
  return [
    { id: crypto.randomUUID(), name: "Margherita Pizza", owner: "Alex", available: 25, cost: 400, status: "Fresh" },
    { id: crypto.randomUUID(), name: "Leftover Pasta", owner: "Alex", available: 100, cost: 200, status: "Fresh" },
    { id: crypto.randomUUID(), name: "Heinz Ketchup", owner: "Jordan", available: 100, cost: 120, status: "Fresh" },
    { id: crypto.randomUUID(), name: "Heinz Ketchup", owner: "Casey", available: 100, cost: 120, status: "Fresh" },
    { id: crypto.randomUUID(), name: "Orange Juice", owner: "Jordan", available: 100, cost: 150, status: "Fresh" },
  ];
}

function loadData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [items, setItems] = useState(() =>
    loadData("fridge-items", createInitialItems()),
  );
  const [requests, setRequests] = useState(() =>
    loadData("fridge-requests", []),
  );
  const [roommate, setRoommate] = useState("Jordan");
  const [selectedItem, setSelectedItem] = useState("");
  const [amount, setAmount] = useState(25);
  const [message, setMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [restoreAmount, setRestoreAmount] = useState(100);

  useEffect(() => {
    localStorage.setItem("fridge-items", JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem("fridge-requests", JSON.stringify(requests));
  }, [requests]);

  // Automatically expire old requests and release their reservations.
  useEffect(() => {
    function expireRequests() {
      const now = Date.now();

      setRequests((previous) =>
        previous.map((request) =>
          ["Pending", "Approved"].includes(request.status) &&
          request.expiresAt <= now
            ? { ...request, status: "Expired" }
            : request,
        ),
      );
    }

    expireRequests();
    const timer = setInterval(expireRequests, 30_000);

    return () => clearInterval(timer);
  }, []);

  function notify(text) {
    setMessage(text);
  }

  function getReserved(itemId, excludeId = null) {
    return requests
      .filter(
        (request) =>
          request.itemId === itemId &&
          request.id !== excludeId &&
          ["Pending", "Approved"].includes(request.status),
      )
      .reduce((sum, request) => sum + request.amount, 0);
  }

  function requestPortion(itemId) {
    const item = items.find((food) => food.id === itemId);

    if (!item) return notify("Food item not found.");
    if (item.status !== "Fresh") return notify("This food is unavailable.");
    if (item.owner === roommate) return notify("You cannot request your own food.");
    if (!Number.isFinite(amount) || amount <= 0) {
      return notify("Enter a valid portion.");
    }

    const unreserved = item.available - getReserved(itemId);

    if (amount > unreserved) {
      return notify(`Only ${Math.max(0, unreserved)}% is unreserved.`);
    }

    const request = {
      id: crypto.randomUUID(),
      itemId,
      requester: roommate,
      amount,
      status: "Pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + DAY,
    };

    setRequests((previous) => [...previous, request]);
    notify("Request submitted. Waiting for owner approval.");
  }

  function approveRequest(requestId) {
    const request = requests.find((entry) => entry.id === requestId);

    if (!request || request.status !== "Pending") {
      return notify("This request is no longer pending.");
    }

    const item = items.find((food) => food.id === request.itemId);

    if (!item || item.status !== "Fresh") {
      return notify("Food is no longer available.");
    }

    if (request.expiresAt <= Date.now()) {
      setRequests((previous) =>
        previous.map((entry) =>
          entry.id === requestId ? { ...entry, status: "Expired" } : entry,
        ),
      );
      return notify("This request has expired.");
    }

    if (item.owner !== roommate) {
      return notify("Only the food owner can approve this request.");
    }

    const unreserved = item.available - getReserved(item.id, request.id);

    if (request.amount > unreserved) {
      setRequests((previous) =>
        previous.map((entry) =>
          entry.id === requestId ? { ...entry, status: "Rejected" } : entry,
        ),
      );
      return notify("Not enough food remains. Request rejected.");
    }

    setRequests((previous) =>
      previous.map((entry) =>
        entry.id === requestId ? { ...entry, status: "Approved" } : entry,
      ),
    );

    notify("Request approved. The portion is reserved for 24 hours.");
  }

  function consumeRequest(requestId) {
    const request = requests.find((entry) => entry.id === requestId);

    if (!request || request.status !== "Approved") {
      return notify("Only approved portions can be consumed.");
    }

    if (request.expiresAt <= Date.now()) {
      setRequests((previous) =>
        previous.map((entry) =>
          entry.id === requestId ? { ...entry, status: "Expired" } : entry,
        ),
      );
      return notify("This approval has expired.");
    }

    const item = items.find((food) => food.id === request.itemId);

    if (!item || item.status !== "Fresh") {
      return notify("Food is no longer available.");
    }

    if (request.amount > item.available) {
      return notify("Insufficient inventory. Please correct the inventory.");
    }

    setItems((previous) =>
      previous.map((food) =>
        food.id === item.id
          ? { ...food, available: food.available - request.amount }
          : food,
      ),
    );

    setRequests((previous) =>
      previous.map((entry) =>
        entry.id === requestId
          ? { ...entry, status: "Consumed", consumedAt: Date.now() }
          : entry,
      ),
    );

    notify(`${request.amount}% consumed by ${request.requester}.`);
  }

  function rejectRequest(requestId) {
    const request = requests.find((entry) => entry.id === requestId);
    const item = items.find((food) => food.id === request?.itemId);

    if (!request || request.status !== "Pending") {
      return notify("Only pending requests can be rejected.");
    }

    if (item?.owner !== roommate) {
      return notify("Only the food owner can reject this request.");
    }

    setRequests((previous) =>
      previous.map((entry) =>
        entry.id === requestId ? { ...entry, status: "Rejected" } : entry,
      ),
    );

    notify("Request rejected. Its reservation has been released.");
  }

  function correctInventory(itemId) {
    setConfirmAction({ type: "missing", itemId });
  }

  function spoilFood(itemId) {
    setConfirmAction({ type: "spoil", itemId });
  }

  function restoreInventory(itemId) {
    setRestoreAmount(100);
    setConfirmAction({ type: "restore", itemId });
  }

  function confirmInventoryAction() {
    if (!confirmAction) return;

    const { type, itemId } = confirmAction;
    const item = items.find((food) => food.id === itemId);

    if (!item) {
      setConfirmAction(null);
      return;
    }

    if (type === "restore") {
      const quantity = Number(restoreAmount);

      if (
        item.status !== "Missing" ||
        !Number.isFinite(quantity) ||
        quantity < 1 ||
        quantity > 100
      ) {
        return notify("Enter a valid recovery quantity from 1% to 100%.");
      }

      setItems((previous) =>
        previous.map((food) =>
          food.id === itemId
            ? { ...food, available: quantity, status: "Fresh" }
            : food,
        ),
      );

      notify(`${item.name} restored with ${quantity}% available.`);
    } else {
      const newStatus = type === "missing" ? "Missing" : "Spoiled";

      setItems((previous) =>
        previous.map((food) =>
          food.id === itemId
            ? { ...food, available: 0, status: newStatus }
            : food,
        ),
      );

      setRequests((previous) =>
        previous.map((request) =>
          request.itemId === itemId &&
          ["Pending", "Approved"].includes(request.status)
            ? { ...request, status: "Expired" }
            : request,
        ),
      );

      notify(
        type === "missing"
          ? "Inventory corrected. Outstanding requests expired."
          : "Food discarded. Outstanding requests expired.",
      );
    }

    setConfirmAction(null);
  }

  function addFood(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const owner = String(form.get("owner") || roommate);
    const cost = Number(form.get("cost"));

    if (!name || !Number.isFinite(cost) || cost <= 0) {
      return notify("Enter a valid food name and positive cost.");
    }

    setItems((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        name,
        owner,
        available: 100,
        cost,
        status: "Fresh",
      },
    ]);

    event.currentTarget.reset();
    notify("Food added with a unique ID.");
  }

  function resetDemo() {
    setConfirmAction({ type: "reset" });
  }

  function performReset() {
    setItems(createInitialItems());
    setRequests([]);
    setConfirmAction(null);
    setSelectedItem("");
    setMessage("Demo data reset.");
  }

  const pendingCount = requests.filter((r) => r.status === "Pending").length;
  const approvedCount = requests.filter((r) => r.status === "Approved").length;
  const availableCount = items.filter(
    (item) => item.status === "Fresh" && item.available > 0,
  ).length;

  function foodEmoji(name) {
    const value = name.toLowerCase();
    if (value.includes("pizza")) return "🍕";
    if (value.includes("pasta")) return "🍝";
    if (value.includes("ketchup")) return "🍅";
    if (value.includes("juice")) return "🧃";
    return "🥡";
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home">
          <span className="brand-icon">F</span>
          <span>FridgePolice</span>
        </a>
        <span className="topbar-note">SHARED FRIDGE CONTROL</span>
        <button className="button button-ghost" onClick={resetDemo}>
          Reset demo
        </button>
      </header>

      <section className="hero" id="home">
        <div>
          <p className="eyebrow">ROOMMATE FOOD MANAGEMENT</p>
          <h1>Good food. Fair shares.<br />Zero fridge drama.</h1>
          <p className="hero-copy">
            Track every item, approve every portion, and keep digital
            inventory aligned with the real fridge.
          </p>
        </div>
        <div className="hero-sticker">
          <span>🥑</span>
          <strong>Freshness first.</strong>
          <small>Trust the data. Verify the fridge.</small>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Available items</span>
          <strong>{availableCount}</strong>
          <small>Food ready to share</small>
        </article>
        <article className="stat-card">
          <span>Awaiting approval</span>
          <strong>{pendingCount}</strong>
          <small>Requests to review</small>
        </article>
        <article className="stat-card">
          <span>Approved portions</span>
          <strong>{approvedCount}</strong>
          <small>Reserved, not yet eaten</small>
        </article>
      </section>

      {message && (
        <div className="notice" role="status">
          <span>{message}</span>
          <button onClick={() => setMessage("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}

      <section className="workspace">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LIVE INVENTORY</p>
            <h2>The shared fridge</h2>
          </div>
          <label className="roommate-picker">
            Acting as
            <select
              value={roommate}
              onChange={(event) => setRoommate(event.target.value)}
            >
              {PEOPLE.map((person) => (
                <option key={person}>{person}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="food-grid">
          {items.map((item) => {
            const reserved = getReserved(item.id);
            const unreserved = Math.max(0, item.available - reserved);

            return (
              <article className="food-card" key={item.id}>
                <div className="food-card-top">
                  <span className="food-emoji">{foodEmoji(item.name)}</span>
                  <span className={`status-pill ${item.status.toLowerCase()}`}>
                    {item.status}
                  </span>
                </div>

                <h3>{item.name}</h3>
                <p className="food-owner">
                  Owned by {item.owner} · ₹{item.cost}
                </p>
                <p className="item-id">ID: {item.id.slice(0, 8)}</p>

                <div className="quantity-row">
                  <span>Available</span>
                  <strong>{item.available}%</strong>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-value"
                    style={{ width: `${item.available}%` }}
                  />
                </div>

                <div className="quantity-foot">
                  <span>{reserved}% reserved</span>
                  <span>{unreserved}% unreserved</span>
                </div>

                <div className="food-actions">
                  <button
                    className="button button-primary"
                    disabled={
                      item.status !== "Fresh" ||
                      item.owner === roommate ||
                      unreserved <= 0
                    }
                    onClick={() => {
                      setSelectedItem(item.id);
                      setAmount(Math.min(25, unreserved));
                      document
                        .getElementById("request-form")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Request portion
                  </button>

                  {item.status === "Missing" ? (
                    <button
                      className="button button-primary"
                      onClick={() => restoreInventory(item.id)}
                    >
                      Restore item
                    </button>
                  ) : (
                    <button
                      className="button button-outline"
                      disabled={item.status !== "Fresh" || item.available === 0}
                      onClick={() => correctInventory(item.id)}
                    >
                      Mark missing
                    </button>
                  )}

                  <button
                    className="button button-danger"
                    disabled={item.status !== "Fresh"}
                    onClick={() => spoilFood(item.id)}
                  >
                    Discard / spoil
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="two-column">
        <article className="panel" id="request-form">
          <p className="eyebrow">SHARE FAIRLY</p>
          <h2>Request a portion</h2>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedItem) return notify("Select a food item first.");
              requestPortion(selectedItem);
            }}
          >
            <label>
              Food item
              <select
                value={selectedItem}
                onChange={(event) => setSelectedItem(event.target.value)}
                required
              >
                <option value="">Choose an item</option>
                {items
                  .filter(
                    (item) =>
                      item.status === "Fresh" &&
                      item.owner !== roommate &&
                      item.available > 0,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.owner} — {item.id.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Portion requested: {amount}%
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value))}
              />
            </label>

            <button className="button button-primary button-full" type="submit">
              Submit request
            </button>
          </form>

          <p className="helper-text">
            Pending requests reserve portions. Expired or rejected requests
            release their reservations.
          </p>
        </article>

        <article className="panel">
          <p className="eyebrow">ADD TO INVENTORY</p>
          <h2>Log new food</h2>

          <form onSubmit={addFood}>
            <label>
              Food name
              <input name="name" placeholder="e.g. Greek yogurt" required />
            </label>
            <label>
              Owner
              <select name="owner" defaultValue={roommate}>
                {PEOPLE.map((person) => (
                  <option key={person}>{person}</option>
                ))}
              </select>
            </label>
            <label>
              Total cost (₹)
              <input name="cost" type="number" min="1" required />
            </label>
            <button className="button button-primary button-full" type="submit">
              + Add food item
            </button>
          </form>

          <p className="helper-text">
            Every food entry has a unique ID, even when names are identical.
          </p>
        </article>
      </section>

      <section className="panel request-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">APPROVAL WORKFLOW</p>
            <h2>Portion requests</h2>
          </div>
          <span className="subtle-count">{requests.length} total</span>
        </div>

        {requests.length === 0 ? (
          <div className="empty-state">
            <span>📋</span>
            <strong>No requests yet</strong>
            <p>Submit a portion request to see the approval workflow here.</p>
          </div>
        ) : (
          <div className="request-list">
            {[...requests].reverse().map((request) => {
              const item = items.find((food) => food.id === request.itemId);
              const isOwner = item?.owner === roommate;
              const isRequester = request.requester === roommate;

              return (
                <div className="request-row" key={request.id}>
                  <div className="request-icon">🍽️</div>
                  <div className="request-info">
                    <strong>{item?.name ?? "Unknown item"}</strong>
                    <p>
                      {request.requester} requested {request.amount}% · ID{" "}
                      {request.itemId.slice(0, 8)}
                    </p>
                    <small>
                      {["Pending", "Approved"].includes(request.status)
                        ? `Expires ${new Date(request.expiresAt).toLocaleString()}`
                        : request.status}
                    </small>
                  </div>

                  <span className={`status-pill ${request.status.toLowerCase()}`}>
                    {request.status}
                  </span>

                  <div className="request-actions">
                    {request.status === "Pending" && isOwner && (
                      <>
                        <button
                          className="button button-primary"
                          onClick={() => approveRequest(request.id)}
                        >
                          Approve
                        </button>
                        <button
                          className="button button-outline"
                          onClick={() => rejectRequest(request.id)}
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {request.status === "Approved" && isRequester && (
                      <button
                        className="button button-primary"
                        onClick={() => consumeRequest(request.id)}
                      >
                        Mark consumed
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <footer>
        <span className="brand-icon">F</span>
        <span>FridgePolice</span>
        <span className="footer-note">
          Built for real roommates and unpredictable fridges.
        </span>
      </footer>

      {confirmAction && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmAction(null);
            }
          }}
        >
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-icon">
              {confirmAction.type === "missing"
                ? "🔎"
                : confirmAction.type === "restore"
                  ? "🥬"
                  : confirmAction.type === "spoil"
                    ? "🗑️"
                    : "↻"}
            </div>

            <p className="eyebrow">INVENTORY MANAGEMENT</p>

            <h2 id="modal-title">
              {confirmAction.type === "missing"
                ? "Mark item as missing?"
                : confirmAction.type === "restore"
                  ? "Restore this item?"
                  : confirmAction.type === "spoil"
                    ? "Discard this food?"
                    : "Reset demo data?"}
            </h2>

            <p className="modal-copy">
              {confirmAction.type === "missing"
                ? "The quantity will become 0%, and outstanding requests will expire."
                : confirmAction.type === "restore"
                  ? "Enter the quantity actually found before making the item available again."
                  : confirmAction.type === "spoil"
                    ? "This food will be marked spoiled and outstanding requests will expire."
                    : "This replaces the current demo inventory and clears all requests."}
            </p>

            {confirmAction.type === "restore" && (
              <label className="restore-field">
                Available quantity (%)
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={restoreAmount}
                  onChange={(event) => setRestoreAmount(event.target.value)}
                />
              </label>
            )}

            <div className="modal-actions">
              <button
                className="button button-outline"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>

              <button
                className="button button-primary"
                onClick={
                  confirmAction.type === "reset"
                    ? performReset
                    : confirmInventoryAction
                }
              >
                {confirmAction.type === "missing"
                  ? "Confirm missing"
                  : confirmAction.type === "restore"
                    ? "Restore inventory"
                    : confirmAction.type === "spoil"
                      ? "Confirm discard"
                      : "Reset demo"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
