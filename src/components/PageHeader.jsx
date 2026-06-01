export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between mb-6 pb-5 border-b border-border shrink-0">
      <div>
        <h1 className="text-xl font-semibold text-primary tracking-tight leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-[13px] text-secondary mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
