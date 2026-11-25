import { Link } from 'react-router-dom';

export default function Page({crumbs = [], actions = null, size = '', children}) {
  return (
    <div className={`page ${size}`}>
      {(crumbs.length > 0 || actions) && (
        <div className="crumbs-row">
          <p className="crumbs">
            {crumbs.map((crumb, index) => (
              <span key={index}>
                {index > 0 && ' / '}
                {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
              </span>
            ))}
          </p>

          {actions}
        </div>
      )}

      {children}
    </div>
  );
}
