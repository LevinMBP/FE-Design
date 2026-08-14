import { useEffect, useRef, useState } from 'react'
import {
  App,
  Button,
  Card,
  Dropdown,
  Input,
  Modal,
  Segmented,
  Select,
  Skeleton,
  Tag,
  Tooltip,
} from 'antd'
import {
  Check,
  Copy,
  Download,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  Printer,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  useCreateQuotationTemplateMutation,
  useDeleteQuotationTemplateMutation,
  useGetQuotationTemplatesQuery,
  useImportQuotationTemplateMutation,
  useSaveQuotationTemplateMutation,
  useSetActiveQuotationTemplateMutation,
} from './adminApi'
import {
  applyPreset,
  resetTemplate,
  TEMPLATE_PRESETS,
  type QuotationTemplate,
} from './mockQuotationTemplate'
import QuotationLayoutControls from './QuotationLayoutControls'
import { SAMPLE_LONG, SAMPLE_SHORT } from './quotationLayoutSample'
import QuotationDocument from '../sales/quotations/QuotationDocument'
import './admin.css'

type NameModal = { mode: 'new' | 'duplicate' | 'rename'; value: string }

const MODAL_TITLE: Record<NameModal['mode'], string> = {
  new: 'New layout',
  duplicate: 'Duplicate layout',
  rename: 'Rename layout',
}

/** Download the template as JSON so it can be moved between environments. */
function exportTemplate(template: QuotationTemplate) {
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${template.name.replace(/[^\w-]+/g, '-').toLowerCase()}-quotation-layout.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Admin › Quotation Layout. Keeps a library of named layouts, one of which is
 * active for the whole org, and edits the selected one against a live preview
 * of the real document component — what you see here is what prints.
 */
function QuotationLayoutPage() {
  const { data: store, isLoading } = useGetQuotationTemplatesQuery()
  const [saveTemplate, { isLoading: isSaving }] = useSaveQuotationTemplateMutation()
  const [createTemplate] = useCreateQuotationTemplateMutation()
  const [deleteTemplate] = useDeleteQuotationTemplateMutation()
  const [setActive, { isLoading: isActivating }] = useSetActiveQuotationTemplateMutation()
  const [importTemplate] = useImportQuotationTemplateMutation()
  const { message, modal } = App.useApp()

  const [selectedId, setSelectedId] = useState<string>()
  const [draft, setDraft] = useState<QuotationTemplate>()
  const [nameModal, setNameModal] = useState<NameModal | null>(null)
  const [zoom, setZoom] = useState(0.75)
  const [sample, setSample] = useState<'short' | 'long'>('short')
  const fileInput = useRef<HTMLInputElement>(null)

  const saved = store?.templates.find((t) => t.id === selectedId)

  // Load the selected layout (or the active one on first render) into the draft.
  useEffect(() => {
    if (!store) return
    const next =
      store.templates.find((t) => t.id === selectedId) ??
      store.templates.find((t) => t.id === store.activeId) ??
      store.templates[0]
    if (!next) return
    setSelectedId(next.id)
    setDraft(next)
  }, [store, selectedId])

  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved)
  const isActive = !!draft && store?.activeId === draft.id

  const set = (patch: Partial<QuotationTemplate>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d))

  /** Switching layouts throws away unsaved edits — ask first. */
  const selectTemplate = (id: string) => {
    if (id === selectedId) return
    if (dirty) {
      modal.confirm({
        title: 'Discard unsaved changes?',
        content: 'Your edits to this layout haven\'t been saved yet.',
        okText: 'Discard',
        okButtonProps: { danger: true },
        onOk: () => setSelectedId(id),
      })
      return
    }
    setSelectedId(id)
  }

  const onSave = async () => {
    if (!draft) return
    try {
      await saveTemplate(draft).unwrap()
      message.success('Quotation layout saved.')
    } catch {
      message.error('Could not save the layout.')
    }
  }

  const onNameModalOk = async () => {
    if (!nameModal || !draft) return
    const name = nameModal.value.trim()
    if (!name) return
    try {
      if (nameModal.mode === 'rename') {
        set({ name })
      } else {
        const created = await createTemplate({
          name,
          sourceId: nameModal.mode === 'duplicate' ? draft.id : undefined,
        }).unwrap()
        setSelectedId(created.id)
        message.success(`Created “${created.name}”.`)
      }
      setNameModal(null)
    } catch {
      message.error('Could not create the layout.')
    }
  }

  const onDelete = async () => {
    if (!draft) return
    try {
      await deleteTemplate(draft.id).unwrap()
      setSelectedId(undefined)
      message.success('Layout deleted.')
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Could not delete the layout.')
    }
  }

  const onActivate = async () => {
    if (!draft) return
    try {
      await setActive(draft.id).unwrap()
      message.success('Quotations now print with this layout.')
    } catch {
      message.error('Could not switch layouts.')
    }
  }

  const onImport = async (file: File) => {
    try {
      const imported = await importTemplate(await file.text()).unwrap()
      setSelectedId(imported.id)
      message.success(`Imported “${imported.name}”.`)
    } catch {
      message.error("That file isn't a valid layout export.")
    }
  }

  if (isLoading || !draft || !store) {
    return (
      <div className="module-view">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    )
  }

  return (
    <div className="module-view">
      <div className="page-head">
        <div>
          <h1>Quotation layout</h1>
          <p>
            Design the quotation document — page, letterhead, columns, blocks and wording.
            Changes preview live; the active layout is what customers receive.
          </p>
        </div>
        <div className="page-head__actions">
          {dirty && (
            <Button onClick={() => saved && setDraft(saved)} disabled={isSaving}>
              Discard changes
            </Button>
          )}
          <Button type="primary" onClick={onSave} loading={isSaving} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </div>

      {/* Layout library */}
      <div className="qtpl-toolbar">
        <div className="qtpl-toolbar__group">
          <span className="qtpl-toolbar__label">Layout</span>
          <Select
            value={draft.id}
            onChange={selectTemplate}
            style={{ minWidth: 240 }}
            options={store.templates.map((t) => ({
              value: t.id,
              label: t.id === store.activeId ? `${t.name} · active` : t.name,
            }))}
          />
          {isActive ? (
            <Tag color="green">Active</Tag>
          ) : (
            <Button size="small" onClick={onActivate} loading={isActivating} icon={<Check size={14} />}>
              Set as active
            </Button>
          )}
          {dirty && <Tag color="orange">Unsaved</Tag>}
        </div>

        <div className="qtpl-toolbar__group">
          <Button
            icon={<FilePlus2 size={16} />}
            onClick={() => setNameModal({ mode: 'new', value: 'New layout' })}
          >
            New
          </Button>
          <Button
            icon={<Copy size={16} />}
            onClick={() => setNameModal({ mode: 'duplicate', value: `${draft.name} copy` })}
          >
            Duplicate
          </Button>
          <Dropdown
            menu={{
              items: [
                { key: 'rename', icon: <Pencil size={14} />, label: 'Rename…' },
                { key: 'export', icon: <Download size={14} />, label: 'Export JSON' },
                { key: 'import', icon: <Upload size={14} />, label: 'Import JSON…' },
                { key: 'reset', icon: <RotateCcw size={14} />, label: 'Reset to defaults' },
                { type: 'divider' },
                {
                  key: 'delete',
                  icon: <Trash2 size={14} />,
                  label: 'Delete layout',
                  danger: true,
                  disabled: store.templates.length <= 1,
                },
              ],
              onClick: ({ key }) => {
                if (key === 'rename') setNameModal({ mode: 'rename', value: draft.name })
                if (key === 'export') exportTemplate(draft)
                if (key === 'import') fileInput.current?.click()
                if (key === 'reset') setDraft(resetTemplate(draft))
                if (key === 'delete') {
                  modal.confirm({
                    title: `Delete “${draft.name}”?`,
                    content: 'This layout will be removed for everyone in the organization.',
                    okText: 'Delete',
                    okButtonProps: { danger: true },
                    onOk: onDelete,
                  })
                }
              },
            }}
          >
            <Button icon={<MoreHorizontal size={16} />} aria-label="More layout actions" />
          </Dropdown>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onImport(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {/* Starting points */}
      <div className="qtpl-presets">
        <span className="qtpl-toolbar__label">Start from</span>
        {TEMPLATE_PRESETS.map((preset) => (
          <Tooltip key={preset.id} title={preset.description}>
            <Button size="small" onClick={() => setDraft(applyPreset(draft, preset))}>
              {preset.name}
            </Button>
          </Tooltip>
        ))}
        <span className="qtpl-presets__hint">
          Presets restyle the page — your wording and custom blocks are kept.
        </span>
      </div>

      <div className="qtpl-editor">
        <Card className="qtpl-editor__controls" styles={{ body: { padding: '8px 16px 20px' } }}>
          <QuotationLayoutControls draft={draft} set={set} />
        </Card>

        <div className="qtpl-editor__preview">
          <div className="qtpl-preview-bar">
            <span className="qtpl-editor__preview-head">Live preview</span>
            <Segmented<'short' | 'long'>
              size="small"
              value={sample}
              onChange={setSample}
              options={[
                { value: 'short', label: '3 items' },
                { value: 'long', label: '9 items' },
              ]}
            />
            <Segmented<number>
              size="small"
              value={zoom}
              onChange={setZoom}
              options={[
                { value: 0.5, label: '50%' },
                { value: 0.75, label: '75%' },
                { value: 1, label: '100%' },
              ]}
            />
            <Tooltip title="Print this preview">
              <Button
                size="small"
                icon={<Printer size={14} />}
                onClick={() => window.print()}
                aria-label="Print preview"
              />
            </Tooltip>
          </div>
          <div className="qtpl-paper" style={{ zoom }}>
            <QuotationDocument doc={sample === 'short' ? SAMPLE_SHORT : SAMPLE_LONG} template={draft} />
          </div>
        </div>
      </div>

      <Modal
        open={!!nameModal}
        title={nameModal ? MODAL_TITLE[nameModal.mode] : ''}
        okText={nameModal?.mode === 'rename' ? 'Rename' : 'Create'}
        onOk={onNameModalOk}
        onCancel={() => setNameModal(null)}
        okButtonProps={{ disabled: !nameModal?.value.trim() }}
        destroyOnHidden
      >
        <Input
          autoFocus
          value={nameModal?.value ?? ''}
          onChange={(e) => setNameModal((m) => (m ? { ...m, value: e.target.value } : m))}
          onPressEnter={onNameModalOk}
          placeholder="e.g. Export customers (English)"
        />
      </Modal>
    </div>
  )
}

export default QuotationLayoutPage
