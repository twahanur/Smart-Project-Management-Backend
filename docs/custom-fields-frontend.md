# Custom Fields Frontend Guide

This guide explains how to use board custom fields in the frontend for a Trello-style project management UI.

## What Custom Fields Are

Custom fields are board-level metadata that can be added by board admins and filled in on each card.

Use them when a board needs extra structured data that does not belong to the core card model, for example:

- story points
- estimate
- client name
- sprint name
- QA status
- blocker flag
- release version
- review date

The backend stores two things separately:

- custom field definitions on the board
- custom field values per card

## Supported Field Types

The backend currently supports:

- `text`
- `number`
- `date`
- `checkbox`
- `dropdown`

## Backend API Shape

### Get board fields

`GET /api/boards/:boardId/custom-fields`

Returns all custom field definitions for the board.

### Create a field

`POST /api/boards/:boardId/custom-fields`

Body example:

```ts
{
  name: string;
  type: 'text' | 'number' | 'date' | 'checkbox' | 'dropdown';
  options?: string[];
}
```

Only board admins can create or delete fields.

### Get card values

`GET /api/boards/:boardId/custom-fields/cards/:cardId/values`

Returns all saved values for that card.

### Set a card value

`POST /api/boards/:boardId/custom-fields/cards/:cardId/fields/:fieldId`

Body example:

```ts
{
  value: string;
}
```

## How The Frontend Should Use It

### Board settings page

Use the board custom fields API to render a field manager where admins can:

- add a new field
- delete an existing field
- choose the field type
- define dropdown options

### Card details modal

Render a dynamic form section inside the card drawer or modal.

Recommended mapping:

- `text` -> input
- `number` -> number input
- `date` -> date picker
- `checkbox` -> toggle or checkbox
- `dropdown` -> select

Load the field definitions for the board first, then load the card values, and merge them in the UI.

### Card list UI

If needed, show only selected custom fields in card previews, for example story points or sprint name.

## Realtime Socket Events

The backend emits board-wide socket events so every user on the board can stay in sync.

### `board:custom-field-created`

Emitted when a board admin creates a new custom field.

Payload shape:

```ts
{
  boardId: string;
  createdByUserId: string;
  field: unknown;
}
```

Frontend action:

- append the new field to the board field list
- re-render custom field forms on open cards

### `board:custom-field-deleted`

Emitted when a custom field is deleted.

Payload shape:

```ts
{
  boardId: string;
  deletedByUserId: string;
  fieldId: string;
  fieldName: string;
}
```

Frontend action:

- remove the field from board settings
- remove that field from all open card editors
- clear the field from any local state if it was visible on cards

### `board:card-custom-field-updated`

Emitted when a card value changes for a custom field.

Payload shape:

```ts
{
  boardId: string;
  updatedByUserId: string;
  cardId: string;
  fieldId: string;
  field: unknown;
  value: string;
  valueRecord: unknown;
}
```

Frontend action:

- update the value in the open card modal
- update any card preview badges or chips that display the field
- if multiple users are viewing the same board, reflect the new value instantly

## Suggested Frontend State Model

Keep custom fields in two layers:

- board field definitions: array of field metadata
- card values: map of `cardId -> fieldId -> value`

That structure makes it easy to update one card without refetching the full board.

Example shape:

```ts
{
  fields: [
    { id: 'field_1', name: 'Story Points', type: 'number', options: [] }
  ],
  cardValues: {
    card_1: {
      field_1: '5'
    }
  }
}
```

## Recommended UI Flow

1. Load board fields when the board page opens.
2. Load card values when a card modal opens.
3. Render inputs based on field type.
4. Save on blur, on select change, or via a dedicated Save button.
5. Listen to socket events to keep other users in sync.

## Validation Notes

The backend already validates:

- number values must be numeric
- checkbox values must be `true` or `false`
- dropdown values must match one of the allowed options

So the frontend should still validate early, but the backend remains the source of truth.

## Practical Trello-Style Usage

For a Trello-like app, custom fields are useful for board-specific tracking that would otherwise require many different card labels or description conventions.

A good rule:

- use labels for broad categories
- use custom fields for structured data
- use the card description for freeform notes

Examples:

- Use `Priority` as a dropdown if the board needs exact values.
- Use `Estimate` as a number if planning or sprint math is needed.
- Use `Blocked` as a checkbox for status visibility.
- Use `Due Review` as a date for review workflow.
- Use `Client` as text for external project tracking.

## Implementation Tip

If you already refetch board data after drag-and-drop, you can apply the same pattern for custom field updates at first.

A simpler first version is:

- send the mutation to the backend
- update local state optimistically
- listen for the socket event
- if the payload looks stale or the UI state is complex, refetch only the affected card or board field list

That keeps the implementation easy and safe.
