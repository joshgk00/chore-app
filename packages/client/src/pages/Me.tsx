import { Link } from "react-router-dom";

export default function Me() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Me</h1>
      <p className="mt-2 text-gray-600">Your profile and badges will appear here.</p>
      <Link
        to="/admin/pin"
        className="mt-4 inline-flex items-center rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
      >
        Admin
      </Link>
    </div>
  );
}
