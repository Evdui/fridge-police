# FridgePolice — Changes and Engineering Decisions

## Project Overview

FridgePolice is a roommate food-tracking prototype built with React and Vite. It helps roommates manage shared food, request portions, approve consumption, and correct inventory when the recorded state no longer matches reality.

The application uses React state and browser localStorage. No backend or database is required for this prototype.

## Features Implemented

- View food items, owners, available quantities, costs, and unique IDs.
- Add new food items to the inventory.
- Request portions of shared food.
- Allow food owners to approve or reject pending requests.
- Record consumption of approved portions.
- Mark food as missing or spoiled.
- Restore missing food with a corrected quantity.
- Expire pending and approved requests after 24 hours.
- Persist inventory and request data in localStorage.
- Display inventory changes and request statuses in the UI.
- Provide an in-app confirmation dialog for inventory actions.

## Scenario 1 — Concurrency Collision

### Problem

Two roommates may attempt to reserve the same remaining portion of food.

### Implementation

The application calculates the unreserved quantity by subtracting pending and approved requests from the available quantity. New requests exceeding the unreserved quantity are rejected. Approval also rechecks the available quantity against other active reservations.

### Engineering Decision

Reservations prevent over-allocation within the current application state. However, React state and localStorage do not provide atomic concurrency control across browser tabs or devices. A production implementation would require an atomic backend operation, such as a database transaction or conditional update.

## Scenario 2 — Spoilage Ghost

### Problem

An approved portion may never be consumed, or the food may spoil before consumption.

### Implementation

Requests have an expiration timestamp set to 24 hours after creation. A periodic check expires pending and approved requests whose deadlines have passed. Discarding food marks it as spoiled, sets its available quantity to zero, and expires outstanding requests.

### Engineering Decision

Expired requests no longer reserve inventory. The prototype performs expiry checks while the app is running; durable server-side expiry would be needed for a multi-user production system.

## Scenario 3 — Identical Item Bug

### Problem

Two roommates may log identical products with the same name.

### Implementation

Every food record receives a unique ID generated with `crypto.randomUUID()`. React renders each record using its ID, and requests refer to the selected item's ID instead of relying on its name.

### Engineering Decision

Unique identifiers keep identical products separate, allowing their owners, quantities, and requests to be managed independently.

## Scenario 4 — Phantom Eater

### Problem

Food may be consumed or removed without the app being updated.

### Implementation

The inventory includes a Mark Missing action. Confirming it sets the available quantity to zero, changes the status to Missing, and expires outstanding requests. The Restore Item action allows a roommate to enter the quantity actually recovered and return the item to Fresh status.

### Engineering Decision

The application provides an explicit correction workflow so users can reconcile the digital inventory with the physical fridge. Restoring an item does not revive expired requests.

## State Persistence

Inventory and request records are stored in localStorage, allowing the data to survive ordinary page refreshes in the same browser. The Reset Demo action restores the initial sample inventory and clears requests.

## Limitations

- There is no authentication or backend.
- Data is local to the browser and is not shared automatically between devices.
- localStorage does not provide transactional concurrency control.
- Request expiry is checked by the active browser session.
- Cost splitting and real payment processing are not implemented.

## Conclusion

FridgePolice demonstrates how explicit item identity, reservation checks, expiration, inventory correction, and clear state transitions can help a small application handle common real-world failure scenarios.
