/**
 * Desktop table wrapper — hidden below lg; use with mobile cards for small screens.
 */
export default function AdminTableShell({ children, minWidth = '900px' }) {
  return (
    <div className="hidden lg:block overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}
