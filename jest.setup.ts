// Native-animation libraries need their Jest mocks; screens importing Sheet/Select rely on this.
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
jest.mock("@gorhom/bottom-sheet", () => require("@gorhom/bottom-sheet/mock"));
