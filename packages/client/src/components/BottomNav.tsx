import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/today", label: "Today", icon: "☀" },
  { to: "/routines", label: "Routines", icon: "✓" },
  { to: "/rewards", label: "Rewards", icon: "★" },
  { to: "/me", label: "Me", icon: "◉" },
];

export default function BottomNav() {
  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-lg">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center py-2 text-sm font-medium ${
                isActive ? "text-indigo-600" : "text-gray-600 hover:text-gray-700"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-600" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
