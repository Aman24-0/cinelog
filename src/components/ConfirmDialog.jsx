import { createSignal } from 'solid-js';

export function ConfirmDialog(props) {
  const [inputValue, setInputValue] = createSignal('');
  
  const handleConfirm = () => {
    if (props.requireInput && inputValue() !== props.requiredValue) {
      props.onCancel();
      return;
    }
    props.onConfirm();
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      props.onCancel();
    }
  };

  return (
    <div 
      class="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onKeyDown={handleKeyDown}
    >
      <div 
        class="glass-surface rounded-2xl p-6 max-w-md w-full border shadow-2xl animate-pop-in"
        style="background: var(--raised); border-color: var(--border-active)"
      >
        <h3 id="dialog-title" class="font-headline text-2xl text-white mb-2">
          {props.title}
        </h3>
        <p class="text-sm mb-4" style="color: var(--muted)">
          {props.message}
        </p>
        
        {props.requireInput && (
          <div class="mb-4">
            <label for="confirm-input" class="sr-only">Type {props.requiredValue} to confirm</label>
            <input
              id="confirm-input"
              type="text"
              value={inputValue()}
              onInput={(e) => setInputValue(e.target.value)}
              class="w-full px-4 py-2 rounded-lg bg-black/30 border focus:outline-none"
              style="border-color: var(--border); color: var(--text)"
              placeholder={`Type "${props.requiredValue}" to confirm`}
              autoFocus
            />
          </div>
        )}
        
        <div class="flex gap-3 justify-end">
          <button
            onClick={props.onCancel}
            class="px-5 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95"
            style="background: var(--raised); color: var(--text); border: 1px solid var(--border)"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            class="px-5 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95"
            style={props.danger 
              ? 'background: #ef4444; color: white; box-shadow: 0 0 16px rgba(239,68,68,0.4)'
              : 'background: var(--p); color: black; box-shadow: 0 0 16px var(--p-glow)'
            }
            autoFocus={!props.requireInput}
          >
            {props.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
