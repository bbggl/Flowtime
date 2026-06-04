import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = '确认删除',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[360px] max-w-[90vw] rounded-2xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border shadow-2xl p-6 flex flex-col gap-4"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              danger
                ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                : 'bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-light-text dark:text-dark-text">
              {title}
            </h3>
            <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-wrap">
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-light-border/50 dark:hover:bg-dark-border/50 transition-colors"
          >
            <X className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              danger
                ? 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700'
                : 'bg-primary hover:bg-primary/90 dark:bg-primary-dark dark:hover:bg-primary-dark/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
