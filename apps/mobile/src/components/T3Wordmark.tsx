import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

const ThemedPath = withUniwind(Path);

export function T3Wordmark(props: {
  readonly height: number;
  readonly color?: ColorValue;
  readonly colorClassName?: string;
}) {
  const aspectRatio = 56 / 68;
  return (
    <Svg
      accessibilityLabel="Hive"
      height={props.height}
      width={props.height * aspectRatio}
      viewBox="36 30 56 68"
    >
      <ThemedPath
        d="M36 30H50V57H78V30H92V98H78V71H50V98H36Z"
        color={props.color}
        colorClassName={props.colorClassName}
        fill="currentColor"
      />
    </Svg>
  );
}
