import { Node, mergeAttributes } from '@tiptap/core'

export type CalloutType = 'note' | 'warning' | 'tip' | 'important' | 'caution'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { type?: CalloutType }) => ReturnType
      toggleCallout: (attrs?: { type?: CalloutType }) => ReturnType
    }
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: { default: 'note' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout': HTMLAttributes.type || 'note',
        class: `callout callout-${HTMLAttributes.type || 'note'}`,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs)
        },
      toggleCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attrs)
        },
    }
  },
})
