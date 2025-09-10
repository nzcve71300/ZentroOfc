import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import zentroLoadingImage from '../assets/zentro-loading.png';

const SplashScreen = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login');
    }, 2000); // Hold for 2 seconds

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <div className="relative w-full h-full">
        <img 
          src={zentroLoadingImage}
          alt="Zentro Loading"
          className="w-full h-full object-cover"
        />
        
        {/* Loading indicator */}
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <div className="loading-spinner"></div>
        </div>
        
        {/* Optional overlay for better text visibility */}
        <div className="absolute inset-0 bg-black/20"></div>
      </div>
    </div>
  );
};

export default SplashScreen;