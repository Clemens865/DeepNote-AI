import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'

export interface SlashCommandState {
  active: boolean
  query: string
  from: number
  to: number
  top: number
  left: number
}

const slashCommandPluginKey = new PluginKey('slashCommand')

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: slashCommandPluginKey,

        state: {
          init(): SlashCommandState {
            return { active: false, query: '', from: 0, to: 0, top: 0, left: 0 }
          },

          apply(tr, prev): SlashCommandState {
            const meta = tr.getMeta(slashCommandPluginKey)
            if (meta !== undefined) return meta
            if (tr.docChanged && prev.active) {
              // Update the query from the current doc
              const { from } = prev
              const $from = tr.doc.resolve(tr.mapping.map(from))
              const textBefore = $from.parent.textBetween(
                0,
                $from.parentOffset,
                undefined,
                '\ufffc'
              )
              const match = textBefore.match(/\/$/)
                ? ''
                : textBefore.match(/\/([^\s]*)$/)?.[1]

              if (match !== undefined && match !== null) {
                const mappedFrom = tr.mapping.map(from)
                return {
                  ...prev,
                  query: match,
                  from: mappedFrom,
                  to: mappedFrom + 1 + match.length,
                }
              }
              // Slash was deleted or space appeared, close
              return { active: false, query: '', from: 0, to: 0, top: 0, left: 0 }
            }
            return prev
          },
        },

        props: {
          decorations(state) {
            const pluginState = slashCommandPluginKey.getState(state) as SlashCommandState
            if (!pluginState?.active) return DecorationSet.empty
            return DecorationSet.empty
          },

          handleKeyDown(view, event) {
            const state = slashCommandPluginKey.getState(view.state) as SlashCommandState

            if (state?.active) {
              if (event.key === 'Escape') {
                view.dispatch(
                  view.state.tr.setMeta(slashCommandPluginKey, {
                    active: false,
                    query: '',
                    from: 0,
                    to: 0,
                    top: 0,
                    left: 0,
                  })
                )
                return true
              }
              // Arrow keys / Enter are handled by the React component
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
                // We dispatch a custom event so the React menu can intercept
                const customEvent = new CustomEvent('slash-command-keydown', {
                  detail: { key: event.key },
                })
                window.dispatchEvent(customEvent)
                return true
              }
            }

            return false
          },

          handleTextInput(view, from, _to, text) {
            if (text !== '/') return false

            const { state } = view
            const $from = state.doc.resolve(from)
            const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')

            // Only trigger at start of line or after a space
            if (textBefore.length === 0 || textBefore.endsWith(' ')) {
              // Wait for the character to be inserted, then set state
              setTimeout(() => {
                const coords = view.coordsAtPos(from + 1)
                view.dispatch(
                  view.state.tr.setMeta(slashCommandPluginKey, {
                    active: true,
                    query: '',
                    from: from + 1,
                    to: from + 2,
                    top: coords.bottom,
                    left: coords.left,
                  } as SlashCommandState)
                )
              }, 0)
            }

            return false
          },
        },
      }),
    ]
  },
})

export function getSlashCommandState(editor: { view: { state: unknown } }): SlashCommandState | null {
  const state = slashCommandPluginKey.getState(
    editor.view.state as Parameters<typeof slashCommandPluginKey.getState>[0]
  ) as SlashCommandState | undefined
  return state?.active ? state : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function closeSlashCommand(editor: any): void {
  editor.view.dispatch(
    editor.view.state.tr.setMeta(slashCommandPluginKey, {
      active: false,
      query: '',
      from: 0,
      to: 0,
      top: 0,
      left: 0,
    })
  )
}
