import Extension from "./index";
import { meta, template } from "../../index.stories";

export default meta("Nodes", "Html");

const Template = template(Extension);

export const Default = Template.bind({});
Default.args = {
  text: `<style>
  table, th, td {
    border: 1px solid black;
    border-collapse: collapse;
  }
  th, td {
    padding: 5px;
    text-align: left;    
  }
</style>
<h2>Cell that spans two columns</h2>
<p>To make a cell span more than one column, use the colspan attribute.</p>

<table style="width:100%">
  <tr>
    <th>Name</th>
    <th colspan="2">Telephone</th>
  </tr>
  <tr>
    <td>Bill Gates</td>
    <td>55577854</td>
    <td>55577855</td>
  </tr>
</table>
<script>
  console.log("hello world");
</script>`,
};
