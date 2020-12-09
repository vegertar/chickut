import React from "react";
import { Story } from "@storybook/react/types-6-0";

import ListItem from "../listitem";
import Extension from "./index";
import { extensionMeta, minimalExtensions } from "../../../index.stories";

export default extensionMeta(Extension, [...minimalExtensions, ListItem]);

const Template: Story = (args) => <Extension {...args} />;

export const Default = Template.bind({});
