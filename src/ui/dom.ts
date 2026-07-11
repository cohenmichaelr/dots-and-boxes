export interface ElProps {
  class?: string
  id?: string
  type?: string
  value?: string
  placeholder?: string
  title?: string
  disabled?: boolean
  ariaLabel?: string
  dataset?: Record<string, string>
  onClick?: (event: MouseEvent) => void
  onInput?: (event: Event) => void
  onChange?: (event: Event) => void
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (props.class) node.className = props.class
  if (props.id) node.id = props.id
  if (props.title) node.title = props.title
  if (props.ariaLabel) node.setAttribute('aria-label', props.ariaLabel)
  if (props.dataset) Object.assign(node.dataset, props.dataset)
  if (props.onClick) node.addEventListener('click', props.onClick as EventListener)
  if (props.onInput) node.addEventListener('input', props.onInput)
  if (props.onChange) node.addEventListener('change', props.onChange)
  if (node instanceof HTMLInputElement) {
    if (props.type) node.type = props.type
    if (props.value !== undefined) node.value = props.value
    if (props.placeholder !== undefined) node.placeholder = props.placeholder
  }
  if (node instanceof HTMLSelectElement && props.value !== undefined) node.value = props.value
  if (node instanceof HTMLButtonElement && props.disabled !== undefined) node.disabled = props.disabled
  for (const child of children) node.append(child instanceof Node ? child : document.createTextNode(child))
  return node
}
