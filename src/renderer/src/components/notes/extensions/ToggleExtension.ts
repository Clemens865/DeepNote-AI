import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    details: {
      setDetails: () => ReturnType
    }
  }
}

export const Details = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'details' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes, { class: 'toggle-block' }), 0]
  },

  addCommands() {
    return {
      setDetails:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              content: [
                {
                  type: 'detailsSummary',
                  content: [{ type: 'text', text: 'Toggle heading' }],
                },
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Toggle content...' }],
                },
              ],
            })
            .run()
        },
    }
  },
})

export const DetailsSummary = Node.create({
  name: 'detailsSummary',
  group: '',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'summary' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', mergeAttributes(HTMLAttributes), 0]
  },
})
