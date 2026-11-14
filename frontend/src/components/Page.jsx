import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Page({crumbs = [], size = '', theme = '', children}) {
  useEffect(() => {
    if (!theme) {
      return undefined;
    }

    document.body.classList.add(theme);

    return () => document.body.classList.remove(theme);
  }, [theme]);

  return (
    <div className={`page ${size}`}>
      {crumbs.length > 0 && (
        <p className="crumbs">
          {crumbs.map((crumb, index) => (
            <span key={index}>
              {index > 0 && ' / '}
              {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
            </span>
          ))}
        </p>
      )}

      {children}
    </div>
  );
}
