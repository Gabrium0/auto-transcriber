import { useCallback, useRef, useEffect } from 'react';
import { type VirtuosoHandle } from 'react-virtuoso';
import { useAutoScrollStore } from '../stores/useAutoScrollStore';

export default function useAutoScroll(
    virtuosoRef: React.RefObject<VirtuosoHandle | null>,
    trigger: unknown 
) {
    const { isAutoScrollEnabled, setAutoScroll, toggleAutoScroll } = useAutoScrollStore();
    const isProgrammaticScroll = useRef(false);
    
    const disableScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const forceScrollToBottom = useCallback(() => {
        if (disableScrollTimeout.current) {
            clearTimeout(disableScrollTimeout.current);
            disableScrollTimeout.current = null;
        }

        if (!isAutoScrollEnabled || !virtuosoRef.current) return;

        isProgrammaticScroll.current = true;
        
        virtuosoRef.current.scrollToIndex({
            index: 'LAST',
            align: 'end',
            behavior: 'smooth',
        });

        setTimeout(() => { isProgrammaticScroll.current = false; }, 800);
    }, [isAutoScrollEnabled, virtuosoRef]);

    useEffect(() => {
        forceScrollToBottom();
    }, [trigger, forceScrollToBottom]);

    const handleToggle = useCallback(() => {
        if (!isAutoScrollEnabled && virtuosoRef.current) {
            isProgrammaticScroll.current = true;
            virtuosoRef.current.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'smooth' });
            setTimeout(() => { isProgrammaticScroll.current = false; }, 800);
        }
        toggleAutoScroll();
    }, [isAutoScrollEnabled, toggleAutoScroll, virtuosoRef]);

    const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
        if (isProgrammaticScroll.current) return;

        if (atBottom) {
            if (disableScrollTimeout.current) {
                clearTimeout(disableScrollTimeout.current);
                disableScrollTimeout.current = null;
            }
            return; 
        }
        if (!atBottom) {
            disableScrollTimeout.current = setTimeout(() => {
                setAutoScroll(false);
            }, 500);
        }
    }, [setAutoScroll]);

    return {
        isAutoScrollEnabled,
        handleToggle,
        handleAtBottomStateChange,
        forceScrollToBottom
    };
}