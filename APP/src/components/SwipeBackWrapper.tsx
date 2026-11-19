import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { useReducedMotion } from '../utils/resilience';

interface SwipeBackWrapperProps {
  children: React.ReactNode;
  backgroundContent: React.ReactNode;
  onSwipeBack: () => void;
  enabled?: boolean;
}

const EDGE_TRIGGER_WIDTH = 20;
const SWIPE_THRESHOLD = 0.3;
const VELOCITY_THRESHOLD = 0.3;

export function SwipeBackWrapper({
  children,
  backgroundContent,
  onSwipeBack,
  enabled = true,
}: SwipeBackWrapperProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const { width: screenWidth } = useWindowDimensions();
  const isAnimatingRef = useRef(false);
  const hasCalledBackRef = useRef(false);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const reducedMotion = useReducedMotion();

  // PanResponder 只创建一次，处理函数经 ref 读取最新值，避免闭包停留在首帧。
  const enabledRef = useRef(enabled);
  const reduceMotionRef = useRef(reducedMotion);
  const onSwipeBackRef = useRef(onSwipeBack);
  const screenWidthRef = useRef(screenWidth);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { reduceMotionRef.current = reducedMotion; }, [reducedMotion]);
  useEffect(() => { onSwipeBackRef.current = onSwipeBack; }, [onSwipeBack]);
  useEffect(() => { screenWidthRef.current = screenWidth; }, [screenWidth]);

  const stopAnimation = () => {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
  };

  const resetToRest = () => {
    stopAnimation();
    if (reduceMotionRef.current) {
      translateX.setValue(0);
      return;
    }
    animationRef.current = Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    });
    animationRef.current.start(() => { animationRef.current = null; });
  };

  useEffect(() => {
    translateX.setValue(0);
    isAnimatingRef.current = false;
    hasCalledBackRef.current = false;
    animationRef.current = null;

    return () => {
      // 卸载时停止动画，避免未结束的动画在后台占用资源。
      stopAnimation();
      translateX.setValue(0);
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // 允许系统或父级手势接管，中断时才能收到 terminate 清理拖拽状态。
      onPanResponderTerminationRequest: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!enabledRef.current || gestureState.x0 > EDGE_TRIGGER_WIDTH) {
          return false;
        }
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isAnimatingRef.current || hasCalledBackRef.current) {
          return;
        }
        const shouldNavigateBack =
          gestureState.dx > screenWidthRef.current * SWIPE_THRESHOLD ||
          gestureState.vx > VELOCITY_THRESHOLD;

        if (!shouldNavigateBack) {
          resetToRest();
          return;
        }

        isAnimatingRef.current = true;
        const finish = () => {
          if (hasCalledBackRef.current) return;
          hasCalledBackRef.current = true;
          isAnimatingRef.current = false;
          onSwipeBackRef.current();
        };

        if (reduceMotionRef.current) {
          // 尊重系统「减少动态效果」：不做位移动画，直接完成返回。
          translateX.setValue(0);
          finish();
          return;
        }

        animationRef.current = Animated.timing(translateX, {
          toValue: screenWidthRef.current,
          duration: 200,
          useNativeDriver: true,
        });
        animationRef.current.start(() => {
          animationRef.current = null;
          finish();
        });
      },
      // 手势被取消/接管：已提交的返回动画继续完成，未提交的拖拽干净复位。
      onPanResponderTerminate: () => {
        if (isAnimatingRef.current || hasCalledBackRef.current) return;
        resetToRest();
      },
    })
  ).current;

  return (
    <View style={styles.wrapper}>
      {/* 底层 - 上一个页面内容 */}
      <View style={styles.backgroundLayer}>
        {backgroundContent}
      </View>
      {/* 遮罩层 */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: translateX.interpolate({
              inputRange: [0, screenWidth],
              outputRange: [0, 0.3],
            }),
          },
        ]}
      />
      {/* 前景 - 当前页面 */}
      <Animated.View
        style={[styles.container, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  container: {
    flex: 1,
    zIndex: 2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    pointerEvents: 'none',
    zIndex: 1,
  },
});
