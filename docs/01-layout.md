# 01. Stack layout

How the web renderer sizes and places stacks, written so a native renderer can reproduce it
frame for frame. The web is the reference: every rule below is what Chrome does with
the CSS that the reference renderer produces for a stack, and each rule is pinned by a fixture in
`fixtures/layout/` whose golden frames come from that CSS.

Reference implementations: the Android and iOS SDKs (same algorithm; their tests check every golden
within 0.1 pt). Change the rules here, in the SDKs and in the fixtures together.

## Units and boxes

- 1 CSS px = 1 pt (iOS) = 1 dp (Android).
- Every box is `box-sizing: border-box`: a stack's width and height include its padding and
  border. A box is never smaller than its padding + border on either axis.
- `border.width` takes layout space on all four sides, also for gradient borders (the
  gradient is drawn in that transparent border).
- `margin` is outside the box and is never collapsed (each stack is a flex item or sits in its
  own formatting context).
- `visible: false` removes the node: no frame, no space, no spacing next to it
  (`stack-hidden-child`).
- An unknown node type renders its `fallback`, else nothing.

## The screen

The root stack (`components_config.base.stack`) is laid out in the screen area (the device
frame of the editor canvas; full screen on mobile):

- Width: fixed, relative (fraction of the screen width), fill (screen width minus margins),
  fit (fit-content, below).
- Height: always the screen height minus the root's vertical margins, whatever `size.height`
  says. The root has `flex-grow: 1; min-height: 0` in `.paywall-content` (`root-fit-height`).
- Position: `margin.leading`, `margin.top`.
- Content taller than the root does **not** grow the root. Children shrink first (flex
  rules below, `root-scroll`); whatever still overflows scrolls inside the root.
- Header and sticky footer: not covered yet (see the end of this page).

## Sizes

`size.width` / `size.height` are each one of:

| Type | Meaning |
|---|---|
| `fixed` | `value` pt |
| `relative` | `value` x the parent's **content box** on that axis (`0.5` = 50%) |
| `fill` | the parent's content box minus the child's margins (`-webkit-fill-available`), with the exceptions below |
| `fit` | width: fit-content; height: the content height |

Where `fill` and `relative` do **not** behave as written above:

| Case | Behaviour | Fixture |
|---|---|---|
| `fill` height of a child of a **vertical** stack (main axis) | content height, i.e. auto. An empty child is 0 tall | `stack-vertical-fill-height` |
| `fill` height of the **first** layer of a z-layer | content height | `stack-zlayer-*` (`base`) |
| `fill` / `relative` height in a horizontal stack whose own height is fit | resolved against the row's line height: the tallest other child | `stack-row-fill-height-auto` |
| `relative` height in a vertical stack whose own height is fit | the stack first takes the height of its other content (relative children count as 0), then the relative child resolves against that height and the stack shrinks its children to fit | `stack-column-relative-in-fit` |
| `fill` / `relative` inside intrinsic sizing (a fit parent measuring its content) | count as their content (0 for an empty stack); they resolve afterwards against the parent's final size | `stack-fit-with-fill-child` |

## Intrinsic widths

Used for `fit` widths and for the minimum size of shrinking items.

- **max-content** of a stack = padding + border + content, where content is:
  vertical: the largest child contribution; horizontal: the sum of child contributions plus
  `spacing` between them; z-layer: the first layer's contribution.
- **min-content**: the same with min-content contributions. A horizontal stack's children
  stay side by side, so its min-content is also a sum (single-line flex).
- A child's **contribution** = its horizontal margins + (its fixed width if `fixed`, else its
  own max-/min-content). `fit`, `fill` and `relative` all contribute their content.
- Text and images contribute their measured min-/max-content widths (`03-text.md`, later).
- **fit-content(available)** = `min(max-content, max(min-content, available))`, where
  `available` is the parent's content width minus the child's margins.

## Vertical stack (`dimension.type: vertical`)

A flex column: `justify-content` = `distribution`, `align-items` = `alignment`, `gap` =
`spacing`. Every child has `flex: 0 1 auto` (no growing, shrinking allowed).

1. **Width** of each child (cross axis): fixed; relative x content width; fill = content
   width minus margins; fit = fit-content(content width minus margins). Children never
   stretch; a child narrower than the stack is placed by `alignment`
   (leading / center / trailing).
2. **Height basis** of each child (main axis): fixed; relative x content height; fill and fit
   = the child's content height at its width.
3. **Minimum height** (`min-height: auto`): the child's content height at its width; for a
   fixed or relative height, the smaller of that and the specified height. An empty stack's
   content height is its padding + border, so it can shrink to that.
4. **Shrink** when the bases plus margins plus spacing exceed the content height: see
   [Shrinking](#shrinking). There is no growing: leftover space is distributed.
5. **Place** children along the axis by `distribution` (below), across by `alignment`.

When the stack's own height is fit, its height is the sum of the children's heights (step 2,
with relative counted as content), margins, spacing, padding and border; then step 1-5 run
with that height (`stack-column-relative-in-fit`).

## Horizontal stack (`dimension.type: horizontal`)

A flex row, otherwise the same as vertical with the axes swapped, except:

- **Width basis** (main axis): fixed; relative x content width; fill = content width minus
  margins; fit = fit-content(content width minus margins).
- **Minimum width** (`min-width: auto`): the child's min-content width; for fixed or relative,
  the smaller of that and the specified width.
- **Height** (cross axis): fixed; relative x content height; fill = content height minus
  margins (`stack-horizontal-fill-height`); fit = content height at the child's final width.
- When the row's own height is fit, its height is the tallest child (fill and relative
  counted as content) plus margins, padding and border; fill and relative children then
  resolve against that line height (`stack-row-fill-height-auto`).

## Z-layer (`dimension.type: zlayer`)

Web structure: the stack holds one wrapper (`width: 100%; height: 100%`); layer 1 sits in
normal flow inside it; layers 2..n are absolutely positioned over the wrapper (`inset: 0`),
each as a one-item flex row placed by the z alignment.

- **Layer 1** (in flow): width as in a vertical stack (fixed / relative / fill / fit-content);
  height fixed, relative x content height, otherwise its content height (**fill is content
  height here**). Placed at the content box's top-leading corner plus its margins, whatever
  the z alignment.
- **Layers 2..n**: each covers the stack's content box. Width basis as in a horizontal stack,
  shrunk to the content width if larger (one-item shrink, `stack-zlayer-fit`). Height: fixed,
  relative x content height, fill = content height minus margins, fit = content height.
  Placed by the alignment (`top_leading` ... `bottom_trailing`): horizontal part
  leading / center / trailing, vertical part top / center / bottom, offsets may be negative.
- A fit z-layer takes the size of layer 1 (plus padding and border); other layers do not
  affect its size and may overflow it.

## Shrinking

CSS "resolve flexible lengths" with `flex-grow: 0; flex-shrink: 1`
(`stack-overflow-*`, `stack-horizontal-fill-width`, `stack-shrink-*`):

1. Available = content size on the main axis - spacing x (n - 1) - all children's main-axis
   margins.
2. Hypothetical size = max(basis, minimum). If their sum fits in the available space, every
   child takes its hypothetical size (nothing grows).
3. Otherwise freeze children whose basis is below their minimum (at the minimum) and children
   whose **inner** basis (basis - padding - border on that axis) is 0.
4. Loop: free space = available - frozen sizes - unfrozen bases. Each unfrozen child gets
   `basis + free x inner / sum(unfrozen inners)` (shrink is proportional to the inner size,
   `stack-shrink-padded`). Clamp each at its minimum; if any was clamped, freeze the clamped
   ones and repeat; otherwise stop (`stack-shrink-min-content`).

## Distribution (main axis)

`free` = content size - children's outer sizes - spacing x (n - 1). Offsets from the content
start:

| `distribution` | Leading space | Extra space between children |
|---|---|---|
| `start` | 0 | 0 |
| `center` | free / 2 | 0 |
| `end` | free | 0 |
| `space_between` | 0 | free / (n - 1) |
| `space_around` | free / 2n | free / n |
| `space_evenly` | free / (n + 1) | free / (n + 1) |

When `free` is negative: `space_between` acts as `start`, `space_around` and `space_evenly` as
`center`; `center` and `end` overflow on both / the leading side. Unknown values act as
`center`.

## Alignment (cross axis)

Offset = (content cross size - child's outer cross size) x 0 / 0.5 / 1 for
leading-top / center / trailing-bottom. It can be negative (the child overflows on both
sides when centered). Children never stretch. Unknown values act as center.

An unknown `dimension.type` renders as a horizontal stack (`mapDimension`).

## Not covered yet

Badge placement (`mapBadge`), header and sticky footer, text and image measurement,
carousel and tabs pages: specified with their component pages, each with fixtures.
