import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type Props = {
  size?: number;
  strokeWidth?: number;
  progress: number; // 0..1
  trackColor?: string;
  progressColor?: string;
  children?: React.ReactNode;
};

export function StepRing({
  size = 220,
  strokeWidth = 18,
  progress,
  trackColor = '#E8F5EC',
  progressColor = '#3FA84E',
  children,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
