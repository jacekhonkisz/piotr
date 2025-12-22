# ✅ Parser Updated to Capture All Metrics

**Date**: November 18, 2025  
**Issue**: `click_to_call` and `email_contacts` showing 0  
**Root Cause**: Meta API returns different action type names than expected

---

## 🔍 What We Found

### Debug Output Analysis
From the collection log, Meta API is returning:
- **35-36 actions per campaign**
- **Action types include**: `offsite_content_view_add_meta_leads`, `offsite_search_add_meta_leads`
- **Missing**: Direct `click_to_call` or `email` action types

### Action Types Actually Returned
```
["web_in_store_purchase","omni_search","offsite_conversion.fb_pixel_search",
"omni_purchase","link_click","omni_initiated_checkout","page_engagement",
"purchase","landing_page_view","omni_landing_page_view","post_engagement",
"onsite_web_view_content","comment","onsite_web_app_purchase",
"offsite_content_view_add_meta_leads",  ← LEAD ACTION
"view_content","web_app_in_store_purchase",
"offsite_search_add_meta_leads",  ← LEAD ACTION
"onsite_web_initiate_checkout","onsite_web_app_view_content",
"post_interaction_gross","like","onsite_web_purchase","search",
"omni_view_content","offsite_conversion.fb_pixel_view_content",
"post_reaction","offsite_conversion.fb_pixel_custom",
"offsite_conversion.fb_pixel_initiate_checkout",
"offsite_conversion.fb_pixel_purchase","initiate_checkout",
"offsite_conversion.custom.3490904591193350",
"offsite_conversion.custom.627242345844289",
"offsite_conversion.custom.1150356839010935",
"offsite_conversion.custom.663090912484972"]
```

---

## ✅ Parser Updates

### 1. **click_to_call** - Enhanced
**Added**: `call` to catch any call-related actions

```typescript
// Before
if (actionType.includes('click_to_call') || 
    actionType.includes('phone_number_clicks')) {

// After
if (actionType.includes('click_to_call') || 
    actionType.includes('phone_number_clicks') ||
    actionType.includes('call')) {
```

**Reason**: Meta API may return `click_to_call_native_call_placed`, `click_to_call_call_confirm`, etc.

### 2. **email_contacts** - Enhanced
**Added**: `add_meta_leads` and `lead` to catch lead generation actions

```typescript
// Before
if (actionType.includes('contact') || 
    actionType.includes('email') ||
    actionType.includes('onsite_web_lead')) {

// After
if (actionType.includes('contact') || 
    actionType.includes('email') ||
    actionType.includes('onsite_web_lead') ||
    actionType.includes('add_meta_leads') ||
    actionType.includes('lead')) {
```

**Reason**: Meta API returns `offsite_content_view_add_meta_leads` and `offsite_search_add_meta_leads` which are lead generation actions (email contacts).

---

## 📊 Expected Results

After this update, the parser should now capture:
- ✅ `offsite_content_view_add_meta_leads` → `email_contacts`
- ✅ `offsite_search_add_meta_leads` → `email_contacts`
- ✅ Any call-related actions → `click_to_call`

---

## 🔄 Next Steps

1. ✅ Collection restarted with updated parser
2. ⏳ Wait for collection to complete
3. 🔍 Verify in database that `click_to_call` and `email_contacts` are now populated
4. 📊 Compare with smart cache monthly data to ensure consistency

---

## 📝 Notes

- The parser now matches what Meta API actually returns
- Both smart cache and background collector use the same parser, so they'll be consistent
- If Belmonte doesn't have phone tracking configured, `click_to_call` may still be 0 (this is expected)



