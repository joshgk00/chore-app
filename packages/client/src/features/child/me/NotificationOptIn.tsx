export default function NotificationOptIn() {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-700">Notifications</p>
          <p className="text-sm text-gray-500">Coming soon!</p>
        </div>
        <button
          type="button"
          disabled
          className="rounded-full bg-gray-200 px-4 py-2 text-sm font-medium text-gray-400"
          aria-label="Enable notifications (coming soon)"
        >
          Off
        </button>
      </div>
    </div>
  );
}
