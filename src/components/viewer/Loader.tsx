import { useEffect, useRef } from 'react';
import { useSharedSpinnerVerb } from '@/hooks/useSharedSpinnerVerb';

type Props = {
  showLoadingText?: boolean;
  /** Tailwind size classes for the spinning image. Defaults to large viewer size. */
  sizeClassName?: string;
};

const Loader = ({
  showLoadingText = false,
  sizeClassName = 'h-32 w-32',
}: Props) => {
  const dot2 = useRef<HTMLSpanElement>(null);
  const dot3 = useRef<HTMLSpanElement>(null);
  const sharedVerb = useSharedSpinnerVerb(showLoadingText);

  useEffect(() => {
    // ANIMATE LAST TWO DOTS WITH DELAYS AND INTERVALS
    const interval = setInterval(() => {
      dot2.current?.classList.toggle('opacity-0');
      setTimeout(() => {
        dot3.current?.classList.toggle('opacity-0');
      }, 300);
      setTimeout(() => {
        dot2.current?.classList.toggle('opacity-0');
        dot3.current?.classList.toggle('opacity-0');
      }, 600);
    }, 900);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className={`relative ${sizeClassName}`}>
        <img
          src={`${import.meta.env.BASE_URL}/kele-loading.png`}
          alt="Kele loading"
          className="h-full w-full animate-spin rounded-full object-cover [animation-duration:2.4s]"
        />
      </div>
      {showLoadingText && (
        <p className="mt-4 text-base text-adam-text-primary">
          {sharedVerb}
          <span>.</span>
          <span
            ref={dot2}
            className="opacity-0 transition-opacity duration-200"
          >
            .
          </span>
          <span
            ref={dot3}
            className="opacity-0 transition-opacity duration-200"
          >
            .
          </span>
        </p>
      )}
    </div>
  );
};

export default Loader;
