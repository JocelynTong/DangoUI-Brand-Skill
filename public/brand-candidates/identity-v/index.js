import {h} from 'vue';
import {Button} from 'dangoui';
// Thin opt-in adapter: original DangoUI props/events are forwarded.
export const GardenButton={
 name:'GardenButton',inheritAttrs:false,
 props:{variant:{type:String,default:'primary'}},
 setup(props,{attrs,slots}){return()=>h(Button,{...attrs,type:props.variant==='outline'?'outline':'primary',extClass:[attrs.extClass,props.variant==='outline'?'iv-outline':'iv-action'],'aria-disabled':attrs.disabled||attrs.loading?'true':undefined},slots)}
};
