import type {
  ComponentPropsWithRef,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';

import { cx } from './cx';

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugins = UseCarouselParameters[1];

interface CarouselProps {
  opts?: CarouselOptions;
  plugins?: CarouselPlugins;
  orientation?: 'horizontal' | 'vertical';
  setApi?: (api: CarouselApi) => void;
}

interface CarouselContextValue extends CarouselProps {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: CarouselApi;
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  selectedIndex: number;
  scrollSnaps: number[];
}

const CarouselContext = createContext<CarouselContextValue | null>(null);

export function useCarousel() {
  const context = useContext(CarouselContext);
  if (!context) {
    throw new Error('useCarousel must be used within Carousel.Root');
  }
  return context;
}

function CarouselRoot({
  orientation = 'horizontal',
  opts,
  setApi,
  plugins,
  className,
  children,
  ...props
}: ComponentPropsWithRef<'div'> & CarouselProps) {
  const [carouselRef, api] = useEmblaCarousel({
    ...opts,
    axis: orientation === 'horizontal' ? 'x' : 'y',
  }, plugins);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const onInit = useCallback((carouselApi: CarouselApi) => {
    if (carouselApi) {
      setScrollSnaps(carouselApi.scrollSnapList());
    }
  }, []);

  const onSelect = useCallback((carouselApi: CarouselApi) => {
    if (!carouselApi) {
      return;
    }
    setCanScrollPrev(carouselApi.canScrollPrev());
    setCanScrollNext(carouselApi.canScrollNext());
    setSelectedIndex(carouselApi.selectedScrollSnap());
  }, []);

  const scrollPrev = useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = useCallback(() => api?.scrollNext(), [api]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollNext();
    }
  }, [scrollNext, scrollPrev]);

  useEffect(() => {
    if (api && setApi) {
      setApi(api);
    }
  }, [api, setApi]);

  useEffect(() => {
    if (!api) {
      return undefined;
    }
    onInit(api);
    onSelect(api);
    api.on('reInit', onInit);
    api.on('reInit', onSelect);
    api.on('select', onSelect);
    return () => {
      api.off('reInit', onInit);
      api.off('reInit', onSelect);
      api.off('select', onSelect);
    };
  }, [api, onInit, onSelect]);

  return (
    <CarouselContext.Provider value={{
      carouselRef,
      api,
      opts,
      plugins,
      orientation,
      setApi,
      scrollPrev,
      scrollNext,
      canScrollPrev,
      canScrollNext,
      selectedIndex,
      scrollSnaps,
    }}>
      <div
        {...props}
        className={cx('relative', className)}
        role="region"
        aria-roledescription="carousel"
        onKeyDownCapture={handleKeyDown}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

interface CarouselContentProps extends ComponentPropsWithRef<'div'> {
  overflowHidden?: boolean;
}

function CarouselContent({
  className,
  overflowHidden = true,
  ...props
}: CarouselContentProps) {
  const { carouselRef, orientation } = useCarousel();
  return (
    <div ref={carouselRef} className={cx('h-full w-full', overflowHidden && 'overflow-hidden')}>
      <div
        {...props}
        className={cx('flex h-full max-h-full', orientation === 'vertical' && 'flex-col', className)}
      />
    </div>
  );
}

function CarouselItem({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      {...props}
      className={cx('min-w-0 shrink-0 grow-0 basis-full', className)}
      role="group"
      aria-roledescription="slide"
    />
  );
}

interface TriggerRenderProps {
  isDisabled: boolean;
  onClick: () => void;
}

interface CarouselTriggerProps {
  direction: 'prev' | 'next';
  children: ReactNode | ((props: TriggerRenderProps) => ReactNode);
  className?: string;
}

function CarouselTrigger({ direction, children, className }: CarouselTriggerProps) {
  const { scrollPrev, canScrollPrev, scrollNext, canScrollNext } = useCarousel();
  const isDisabled = direction === 'prev' ? !canScrollPrev : !canScrollNext;
  const onClick = direction === 'prev' ? scrollPrev : scrollNext;

  if (typeof children === 'function') {
    return <>{children({ isDisabled, onClick })}</>;
  }
  return (
    <button className={className} type="button" disabled={isDisabled} onClick={onClick}>
      {children}
    </button>
  );
}

interface IndicatorRenderProps {
  isSelected: boolean;
  onClick: () => void;
}

interface CarouselIndicatorProps {
  index: number;
  children: ReactNode | ((props: IndicatorRenderProps) => ReactNode);
  className?: string;
}

function CarouselIndicator({ index, children, className }: CarouselIndicatorProps) {
  const { api, selectedIndex } = useCarousel();
  const isSelected = selectedIndex === index;
  const onClick = () => api?.scrollTo(index);

  if (typeof children === 'function') {
    return <>{children({ isSelected, onClick })}</>;
  }
  return (
    <button
      className={className}
      type="button"
      aria-current={isSelected ? 'true' : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface CarouselIndicatorGroupProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  children: (props: { index: number }) => ReactNode;
}

function CarouselIndicatorGroup({ children, ...props }: CarouselIndicatorGroupProps) {
  const { scrollSnaps } = useCarousel();
  return (
    <nav {...props}>
      {scrollSnaps.map((_snap, index) => children({ index }))}
    </nav>
  );
}

/**
 * Untitled UI React carousel primitive, adapted from the MIT-licensed source
 * pinned by flake.nix. Embla owns drag, snap, and viewport behavior.
 */
export const Carousel = {
  Root: CarouselRoot,
  Content: CarouselContent,
  Item: CarouselItem,
  PrevTrigger: (props: Omit<CarouselTriggerProps, 'direction'>) => (
    <CarouselTrigger {...props} direction="prev" />
  ),
  NextTrigger: (props: Omit<CarouselTriggerProps, 'direction'>) => (
    <CarouselTrigger {...props} direction="next" />
  ),
  IndicatorGroup: CarouselIndicatorGroup,
  Indicator: CarouselIndicator,
};
