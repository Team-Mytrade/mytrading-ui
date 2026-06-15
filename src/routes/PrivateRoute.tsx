import { JSX, useContext } from 'react';

import { AuthContext } from '../context/AuthContext';
import SignIn from '../pages/AuthPages/SignIn';

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const { isLoggedIn } = useContext(AuthContext);
  return isLoggedIn ? children : <SignIn />;
};

export default PrivateRoute;
