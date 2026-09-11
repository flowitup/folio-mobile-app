import type { HelpCatalogue, HelpChrome } from "./types";

/**
 * Bản tiếng Việt của hướng dẫn quy trình trong app, dịch từ `./en.ts` và dùng đúng từ ngữ
 * mà giao diện đang hiển thị (`src/i18n/locales/vi.json`). Mỗi bước đều chỉ tới một nút có
 * thật trên màn hình; những nút app không còn vẽ ra nữa thì cố ý không nhắc tới.
 */
export const helpCatalogueVi: HelpCatalogue = [
  {
    id: "getting-started",
    title: "Đăng nhập và tham gia công ty",
    purpose:
      "Folio đăng nhập bằng số điện thoại và một mã gửi qua SMS — không có mật khẩu. Trước khi xem được gì, tài khoản của bạn phải thuộc về một công ty.",
    steps: [
      "Nhập số điện thoại rồi bấm “Gửi mã”. Chỉ nhận số Pháp, bỏ số 0 đầu.",
      "Nhập 6 số trong tin nhắn. Đủ số thứ sáu là app tự đăng nhập.",
      "Chưa có tài khoản? Bấm “Tạo tài khoản”, xác nhận số điện thoại theo cách trên, nhập tên rồi bấm “Tạo hồ sơ”.",
      "Nếu chưa thuộc công ty nào, chọn “Tạo công ty” — điền tên pháp lý và địa chỉ — hoặc “Nhập mã tham gia” rồi gõ mã 8 ký tự quản trị viên đưa cho bạn.",
      "Nếu bạn vào với vai trò thành viên mà chưa có công trình nào, bạn chờ ở màn hình “Sắp xong rồi” cho tới khi quản trị viên phân công bạn vào một công trình. Kéo xuống để tải lại.",
      "Sau này, vào Cài đặt → “Tham gia công ty khác” là mở lại đúng màn hình nhập mã đó.",
    ],
    whoCanDoIt:
      "Ai cũng làm được. Nút “Tạo tài khoản” chỉ hiện khi máy chủ cho phép tự đăng ký.",
    gotchas: [
      "Lúc đăng nhập chỉ chấp nhận số điện thoại Pháp.",
      "Màn hình nào trong phần này cũng có “Đăng xuất” để thoát ra nếu bạn chọn nhầm tài khoản.",
    ],
  },
  {
    id: "shell",
    title: "Đi lại trong app",
    purpose:
      "Mỗi lúc chỉ chọn một công trình, và cả app đều nói về công trình đó. Thanh tab giữ bốn màn hình của công trình; mọi thứ còn lại nằm trong Menu.",
    steps: [
      "Bấm tên công trình ở trên cùng, rồi chọn một công trình trong danh sách — mỗi dòng cho biết ngân sách còn lại.",
      "Cũng trong bảng đó, “+ Công trình mới” tạo một công trình: tên, địa chỉ, ngân sách và nguồn ngân sách.",
      "Nếu bạn là quản lý, bốn tab là Tổng quan, Chi phí, Nhân công và Kế hoạch. Nếu bạn là thợ, đó là Chấm công, Lương, Hồ sơ và Kế hoạch.",
      "Quản lý có thêm mục “Menu” cho mọi thứ còn lại: báo giá và hóa đơn, thư viện sản phẩm, thành viên công ty, và các mục của công trình — tài liệu, ảnh, ghi chú, lương, chiffrage, phân tích, thành viên và cài đặt. Thợ không có Menu, nên các chủ đề bên dưới bắt đầu từ Menu là để đọc cho biết, không phải để làm theo.",
      "Bấm chữ viết tắt tên bạn để vào Cài đặt, chọn ngôn ngữ (English, Français, Tiếng Việt) và “Đăng xuất”.",
      "Bấm chuông để xem những việc đang chờ bạn, bấm dấu hỏi để mở hướng dẫn này.",
    ],
    whoCanDoIt:
      "Ai cũng đổi được công trình và mở được tài khoản của mình. Tạo công trình cần quyền tạo công trình hoặc quyền quản trị công ty. Báo giá và hóa đơn, thành viên công ty và tài liệu chỉ hiện với người được phép.",
    gotchas: [
      "Tab Chi phí tự vẽ thanh đầu riêng có nút chuyển tháng, nên trên màn hình đó không có chuông, ảnh đại diện và cả hướng dẫn này — hãy mở hướng dẫn từ tab khác.",
      "Công trình mới được tạo trong công ty chính của bạn, và bạn thành người quản lý công trình đó.",
    ],
  },
  {
    id: "overview",
    title: "Tổng quan công trình",
    purpose:
      "Bản tóm tắt tiền bạc và công việc của công trình đang chọn: còn bao nhiêu để chi, đang nợ gì, tháng này chi bao nhiêu, tuần tới có gì và hôm nay ai ở công trường.",
    steps: [
      "Đọc con số lớn trên cùng — phần còn lại, đặt cạnh dòng “Đã chi … trên … tín dụng”.",
      "Dùng các nút nhanh: “Hoá đơn” mở một chi phí mới, “Giải ngân” mở đúng biểu mẫu đó nhưng đặt sẵn là rút tiền ngân hàng, “Trả lương” nhảy sang tab Nhân công ở mục Thanh toán.",
      "Xem hai ô đang nợ: “Chưa trả” dẫn tới “Trả ngay”, “Chờ hoàn” mở những chi phí công ty còn nợ lại bạn.",
      "Bấm thẻ chi tiêu trong tháng để mở toàn bộ sổ chi phí của tháng đó.",
      "Bấm “Lịch trình” trên thẻ “Tuần này” để mở Kế hoạch.",
      "“Hôm nay tại công trường” cho biết dự kiến có bao nhiêu thợ và thời tiết tại địa chỉ công trình.",
    ],
    whoCanDoIt:
      "Ai ở trong công trình cũng xem được. Không có quyền xem ngân sách thì con số tín dụng ngân hàng bị bỏ đi chứ không hiện bằng 0.",
    gotchas: [
      "Thợ thấy màn hình chấm công của chính mình ở đây thay vì màn hình tổng quan.",
    ],
  },
  {
    id: "planning",
    title: "Công việc và kế hoạch",
    purpose:
      "Bảng công việc của công trình, mỗi lần xem một cột. Quản lý và thợ nhìn thấy cùng một bảng.",
    steps: [
      "Chọn cột ở thanh chọn: Tồn đọng, Cần làm, Đang làm, Bị chặn hoặc Xong.",
      "Bấm “Công việc” để thêm một việc: bắt buộc có tiêu đề, rồi mô tả, cột, ưu tiên, hạn và nhãn. Bấm “Lưu”.",
      "Bấm vào một thẻ để mở ra sửa lại.",
      "Tích ô trên thẻ để đẩy thẳng việc sang Xong, hoặc đưa ngược về Cần làm.",
      "Khi đang sửa, “Lên” và “Xuống” đổi chỗ việc đó trong cột.",
      "Khi đang sửa, “Xoá” bỏ việc đó sau một lần xác nhận.",
    ],
    whoCanDoIt:
      "Ai ở trong công trình cũng đọc, tạo và sửa được công việc. Xoá thì cần quyền sửa công trình, nên thợ không xoá được.",
  },
  {
    id: "attendance",
    title: "Chấm công",
    purpose:
      "Ghi lại mỗi ngày trong tháng có những thợ nào ở công trường và làm ca gì. Đây là dữ liệu để tính lương.",
    steps: [
      "Chọn tháng bằng nút chuyển tháng ở đầu tab Nhân công, rồi vào mục “Chấm công”.",
      "Đổi qua lại giữa “Lịch” và “Danh sách”; hàng phía trên cho biết số ngày công, chi phí và phần còn chưa trả.",
      "Bấm vào một ngày, rồi bấm “Chấm công ngày này”.",
      "Trong bảng, bấm từng thợ có mặt, bấm vào tên họ để đổi vòng giữa “Cả ngày”, “Nửa ngày” và “Tăng ca”, dùng +/− cho giờ thêm. Xong thì bấm nút “Chấm …”.",
      "Bấm vào một bản ghi đã có để đổi ca, giờ thêm, ghi đè số tiền hay ghi chú — hoặc để xoá nó.",
      "Bấm “Hoạt động & ghi chú ›” để ghi hôm đó làm những gì và mô tả cả ngày.",
      "Dùng nút tải về để xuất nhiều tháng, cho một thợ hoặc cho tất cả.",
    ],
    whoCanDoIt:
      "Người quản lý chấm công của công trình. Không có quyền đó thì tab Nhân công trở thành hồ sơ của chính bạn.",
    gotchas: [
      "Chấm cho một thợ đã được chấm ở công trình khác cùng ngày thì app hỏi lại, bấm “Vẫn chấm công” để xác nhận.",
    ],
  },
  {
    id: "attendance-validation",
    title: "Duyệt ngày công thợ tự khai",
    purpose:
      "Thợ tự khai ngày công của mình; bạn duyệt hoặc từ chối. Phần này nằm trong chuông, không nằm ở tab Nhân công.",
    steps: [
      "Bấm chuông trên thanh đầu màn hình.",
      "Khối trên cùng là “Chấm công chờ duyệt”, mỗi dòng là một thợ và một ngày kèm ca họ khai.",
      "Với khai báo mới, bấm “Duyệt” để nhận, hoặc “Từ chối” — từ chối là xoá bản ghi nên app hỏi lại trước.",
      "Khi thợ xin sửa một ngày bạn đã duyệt, dòng đó hiện giá trị cũ và giá trị mới; hai nút đổi thành “Áp dụng” và “Từ chối”.",
      "Từ chối yêu cầu sửa thì ngày công giữ nguyên như đã duyệt.",
    ],
    whoCanDoIt:
      "Những người được công trình ghi là người duyệt — thực tế là ai quản lý chấm công. Không có gì chờ thì khối này không hiện ra.",
    gotchas: [
      "Chuông tự tải lại khoảng mỗi phút một lần, nên ngày công thợ khai lúc bạn đang mở app sẽ tự hiện lên.",
    ],
  },
  {
    id: "workers",
    title: "Thợ và đơn giá ngày",
    purpose:
      "Đội thợ của công trình này: ai làm ở đây, vai trò gì, đơn giá ngày bao nhiêu, và đơn giá đó đã thay đổi thế nào.",
    steps: [
      "Mở tab Nhân công, chọn mục “Nhân công”, rồi bấm “Thêm nhân công”.",
      "Chọn “Thợ của công ty” để lấy người có sẵn trong danh bạ công ty, hoặc “Người mới” để tự nhập.",
      "Điền tên, đơn giá ngày, số điện thoại, vai trò, và gắn tài khoản app nếu người đó có. Bấm “Lưu”.",
      "Bấm vào một thợ để thấy “Sửa”, “Đơn giá” và “Xoá”.",
      "“Đơn giá” hiện mức hiện tại và lịch sử. Đặt ngày áp dụng và mức mới, đọc dòng cho biết việc này tính lại bao nhiêu ngày công đã chấm, rồi bấm “Thêm thay đổi”.",
      "Xoá một thợ vẫn giữ nguyên lịch sử chấm công của họ ở công trình.",
    ],
    whoCanDoIt:
      "Người quản lý chấm công của công trình. Lấy người từ danh bạ công ty thì còn cần bạn quản trị hoặc quản lý công ty đó.",
    gotchas: [
      "Mỗi lần đổi đơn giá đều gắn với một ngày, và nó tính lại những ngày công đã chấm từ ngày đó trở đi — bảng sẽ báo trước khi bạn lưu.",
    ],
  },
  {
    id: "labor-payments",
    title: "Trả tiền cho thợ",
    purpose:
      "Xem mỗi thợ còn được nhận bao nhiêu trong tháng và ghi lại số bạn đã thực trả.",
    steps: [
      "Mở tab Nhân công và chọn mục “Thanh toán”.",
      "Đọc từng dòng thợ: còn nợ hay đã đủ, và đã trả bao nhiêu trên tổng phải trả.",
      "Bấm “Ghi thanh toán”, hoặc bấm thẳng vào dòng của thợ.",
      "Chọn thợ, chỉnh số tiền — app điền sẵn phần còn nợ — rồi chọn phương thức thanh toán.",
      "Xác nhận bằng nút “Ghi thanh toán”.",
      "Bên dưới danh sách, “Hoá đơn nhân công chưa gán” gom những chi phí nhân công chưa gắn với ai; bấm vào một dòng để mở và gán thợ.",
    ],
    whoCanDoIt:
      "Quản lý chấm công là vào được màn hình này; ghi thanh toán thì cần thêm quyền quản lý hoá đơn, không có thì nút bị ẩn.",
    gotchas: [
      "Ghi một khoản thanh toán là tạo ra một chi phí nhân công cho công trình, nên nó cũng hiện trong sổ Chi phí.",
    ],
  },
  {
    id: "salaries",
    title: "Lương theo từng tháng",
    purpose:
      "Theo từng thợ và từng tháng: kiếm được bao nhiêu so với đã nhận bao nhiêu, và còn phải trả bao nhiêu.",
    steps: [
      "Mở Menu → Lương rồi chọn một thợ.",
      "Đọc các tổng: tổng kiếm được, tổng đã trả và phần còn phải trả.",
      "Mỗi thẻ tháng cho biết tháng đó đã trả, trả một phần, chưa trả hay trả dư, kèm số ngày công và số tiền.",
      "Bấm “Đánh dấu đã trả” trên một tháng, nhập số tiền và phương thức thanh toán, rồi xác nhận.",
      "“Đánh dấu chưa trả” xoá các khoản thanh toán đã ghi cho tháng đó sau một lần xác nhận.",
    ],
    whoCanDoIt:
      "Ai mở được mục này thì đọc được. Đổi trạng thái đã trả thì cần quyền quản lý hoá đơn; không có, màn hình sẽ nói thẳng.",
    webOnlyNote:
      "Ứng dụng web không có trang lương — màn hình này chỉ có trên điện thoại.",
  },
  {
    id: "expenses",
    title: "Sổ chi phí",
    purpose:
      "Mọi đồng tiền đã ra khỏi công trình, theo từng tháng: hoá đơn nhà cung cấp, vốn giải ngân, tiền trả nhân công và phiếu trả hàng của nhà cung cấp.",
    steps: [
      "Chuyển tháng bằng hai mũi tên ở đầu tab Chi phí.",
      "Đọc tổng của tháng, số khoản, mức chênh so với tháng trước, và quỹ công ty cùng quỹ cá nhân.",
      "Lọc theo loại: tất cả, vốn giải ngân, nhân công, vật tư & DV, hoặc khác.",
      "Nếu có chi phí đang chờ hoàn, một dải thông báo đếm số khoản và nút “Xem” mở chúng ra.",
      "Bấm vào bất kỳ dòng nào để mở đầy đủ chi phí đó.",
      "Dùng “Xuất Excel / PDF” để xuất nhiều tháng.",
      "Bấm nút + tròn ở góc dưới bên phải để ghi một chi phí mới.",
    ],
    whoCanDoIt:
      "Ai ở trong công trình cũng xem được. Quyền xem ngân sách quyết định hai thẻ quỹ và bộ lọc vốn giải ngân.",
    gotchas: [
      "Nút chuyển tháng dừng lại ở tháng gần nhất có dữ liệu.",
      "Thợ thấy lương của chính mình ở đây thay vì sổ chi phí.",
    ],
  },
  {
    id: "expense-create",
    title: "Ghi một chi phí",
    purpose:
      "Nhập một khoản chi: hoá đơn nhà cung cấp, tiền trả nhân công, một lần rút tín dụng ngân hàng, hoặc phiếu avoir của nhà cung cấp.",
    steps: [
      "Chọn loại: vốn giải ngân, nhân công, vật tư & dịch vụ, khác, hoặc trả hàng / avoir.",
      "Đặt ngày phát hành — bắt buộc.",
      "Với nhân công, chọn thợ và tháng làm việc.",
      "Điền người nhận, thêm địa chỉ người nhận nếu cần, và chọn phương thức thanh toán.",
      "Với trả hàng, liên kết hoá đơn vật tư & dịch vụ được hoàn, cho biết hoàn bằng tiền mặt hay bằng avoir, và nếu là avoir thì nó được áp dụng cho hoá đơn nào.",
      "Thêm ít nhất một dòng có mô tả, số lượng, đơn giá và mức VAT.",
      "Kiểm lại các tổng, thêm ghi chú hoặc màu tô, rồi bấm “Tạo hoá đơn”.",
    ],
    whoCanDoIt:
      "Ai ở trong công trình cũng mở được biểu mẫu; máy chủ quyết định có nhận khoản chi đó không. Loại vốn giải ngân chỉ hiện khi bạn có quyền xem ngân sách.",
  },
  {
    id: "expense-detail",
    title: "Tệp đính kèm và hoàn tiền của một chi phí",
    purpose:
      "Mọi thứ về một khoản chi: số tiền, trả cho ai, các dòng hàng, tệp đính kèm, và công ty còn nợ hoàn lại cho bạn hay không.",
    steps: [
      "Mở một chi phí từ sổ. Phần trên cùng hiện tổng tiền, người nhận, ngày, phương thức thanh toán và quỹ đã chi ra.",
      "Các nút tròn là “PDF”, “Đính kèm”, “Sửa” và “Xoá”.",
      "Nếu bạn tự bỏ tiền trả một khoản vật tư & dịch vụ, dải “Chi hộ công ty, chờ hoàn lại?” cho bạn bấm “Chuyển” để bắt đầu theo dõi khoản đó.",
      "Khi đã theo dõi và công ty đã trả lại tiền cho bạn, bấm “Đã hoàn”.",
      "Trong “Tệp đính kèm”, bạn chụp ảnh, chọn từ thư viện ảnh, hoặc chọn tệp. Mỗi tệp đều mở, đổi tên hoặc xoá được.",
      "Các ô màu đặt màu tô cho dòng này trong sổ chi phí.",
    ],
    whoCanDoIt:
      "Ai ở trong công trình cũng đọc được. Mọi thay đổi — đính kèm, sửa, xoá, tô màu, chuyển, đánh dấu đã hoàn — đều cần quyền quản lý hoá đơn; không có thì chỉ còn lại nút “PDF”.",
    webOnlyNote:
      "Ứng dụng web in hoá đơn qua một trang in riêng; điện thoại tự tạo PDF ngay trên máy rồi đưa sang khung chia sẻ quen thuộc.",
  },
  {
    id: "billing",
    title: "Báo giá và hóa đơn cho khách của bạn",
    purpose:
      "Những tài liệu công ty bạn xuất cho khách của mình — báo giá (devis) và hóa đơn (factures) — kèm mẫu dùng lại được và phần theo dõi chi phí chờ hoàn.",
    steps: [
      "Mở Menu → “Báo giá & hóa đơn” rồi chuyển giữa “Báo giá” và “Hóa đơn”. Tìm theo số hoặc người nhận và lọc theo trạng thái.",
      "Bấm “Mới” và chọn “Trống”, “Từ tài liệu có sẵn” (chép lại mọi thứ trừ ngày tháng) hoặc “Từ mẫu”.",
      "Điền công ty phát hành, công trình, khối người nhận, ngày tháng, các dòng và các tổng, rồi bấm “Tạo”.",
      "Trên một tài liệu, đẩy trạng thái đi tiếp — đã gửi, đã chấp nhận, đã thanh toán, đã hủy — và xuất ra PDF hoặc XLSX.",
      "“Nhân bản” chép lại một tài liệu; báo giá đã được chấp nhận thì bấm “Chuyển thành hóa đơn”.",
      "“Mẫu” chứa các mẫu báo giá và hóa đơn của bạn; “Dùng” tạo tài liệu mới từ một mẫu.",
      "“Chi phí hoàn lại” theo dõi các chi phí công trình đang chờ hoàn: thêm chúng vào, đặt trạng thái, và cho biết công ty, ngân hàng hay cả hai đã hoàn.",
    ],
    whoCanDoIt:
      "Chỉ quản trị viên công ty. Người khác không thấy dòng này trong Menu.",
    webOnlyNote:
      "Ứng dụng web tách báo giá và hóa đơn thành hai phần riêng; điện thoại gộp cả hai vào chung một danh sách.",
  },
  {
    id: "company-members",
    title: "Thành viên công ty và quyền",
    purpose:
      "Danh bạ công ty: ai thuộc công ty, giữ vai trò gì, được cấp hay bị từ chối thêm quyền nào, và người mới vào bằng cách nào.",
    steps: [
      "Mở Menu → “Thành viên công ty”. Nếu bạn quản trị nhiều công ty, chọn một công ty ở trên cùng.",
      "Mã công ty nằm trên cùng — tạo mã, làm mã mới, chia sẻ hoặc thu hồi ngay tại đó.",
      "Bấm “Thêm bằng số điện thoại” để thêm người theo số, kèm tên nếu muốn và vai trò thành viên hay quản lý.",
      "“Nhập từ công ty khác” chép người sang từ một công ty khác mà bạn cũng quản trị.",
      "Trong danh sách thành viên, đổi vai trò ngay tại dòng, hoặc mở “Quyền tuỳ chỉnh” để cấp hoặc từ chối một quyền cụ thể, cho toàn công ty hoặc chỉ trên một công trình.",
      "“Hồ sơ chờ” liệt kê những người bạn thêm bằng số điện thoại mà chưa đăng nhập lần nào.",
    ],
    whoCanDoIt:
      "Quản trị viên công ty. Thành viên nào đã là quản trị viên thì không có bảng quyền tuỳ chỉnh.",
    webOnlyNote: "Ứng dụng web có cùng danh bạ này trong Cài đặt → Công ty.",
    gotchas: [
      "Có hai cách vào song song: mã công ty dùng lại được mà ai cũng gõ được, và mã mời dùng một lần, hết hạn sau bảy ngày.",
    ],
  },
  {
    id: "project-members",
    title: "Ai làm ở công trình này",
    purpose:
      "Phân công những người đã có trong công ty vào công trình này, và giao vai trò cho họ ở đây.",
    steps: [
      "Mở Menu → Thành viên, rồi bấm “Phân công thành viên”.",
      "Chọn người trong danh sách thành viên công ty và chọn vai trò, rồi bấm “Phân công”.",
      "Danh sách hiện tất cả những người đã được phân công, vai trò và ngày họ tham gia.",
      "Bấm “Gỡ” trên một dòng để đưa người đó ra khỏi công trình, sau một lần xác nhận.",
      "Những lời mời qua email cũ vẫn nằm ở “Lời mời đang chờ” kèm ngày hết hạn và nút “Thu hồi”.",
    ],
    whoCanDoIt:
      "Người có quyền quản lý thành viên hoặc mời người vào công trình. Bạn không tự gỡ được chính mình.",
    gotchas: [
      "Người mới phải được thêm vào công ty trước, bằng số điện thoại, từ màn hình thành viên công ty — ở đây bạn không tạo được lời mời qua email.",
      "Quản trị viên công ty mặc nhiên có mặt ở mọi công trình của công ty và không bao giờ hiện trong danh sách.",
    ],
  },
  {
    id: "library",
    title: "Thư viện sản phẩm",
    purpose:
      "Danh mục những sản phẩm công ty hay mua, kèm nhà cung cấp, giá và lịch sử mua hàng, dùng lại được khi bạn báo giá một công việc.",
    steps: [
      "Mở Menu → “Thư viện sản phẩm”. Tìm theo tên, và lọc theo nhà cung cấp hoặc danh mục.",
      "Bấm “Thêm sản phẩm” rồi điền tên — bắt buộc — cùng nhà cung cấp, mã tham chiếu, danh mục, kích cỡ, mô tả, URL và một hình ảnh.",
      "Bấm “So sánh”, chọn vài sản phẩm, rồi bấm “So sánh” lần nữa để xem chúng cạnh nhau.",
      "Bấm vào một sản phẩm để xem chi tiết: nhà cung cấp, mã, đã mua bao nhiêu lần, đơn giá gần nhất và lịch sử mua hàng.",
      "Xoá một sản phẩm thì app báo nó đang giữ bao nhiêu bản ghi mua hàng và bắt bạn gõ lại tên sản phẩm.",
      "“Nhập mua hàng” nhận một tệp xuất từ Leroy Merlin, chọn tệp hoặc dán vào, rồi báo lại đã tạo, cập nhật và bỏ qua những gì.",
    ],
    whoCanDoIt:
      "Ai mở được Menu đều vào được thư viện. Máy chủ quyết định có nhận thay đổi của bạn không và sẽ báo lại nếu không nhận.",
    gotchas: [
      "Số sản phẩm và nhà cung cấp hiện trên dòng Menu lấy từ công ty đầu tiên của bạn, có thể không phải công ty của công trình này.",
    ],
  },
  {
    id: "chiffrage",
    title: "Báo giá vật tư",
    purpose:
      "Tính giá vật tư cho công việc: hạng mục, rồi mục theo từng phòng, rồi giá theo từng cửa hàng, kèm giỏ hàng và tổng tiền chạy theo mỗi cửa hàng.",
    steps: [
      "Mở Menu → Chiffrage và dựng khung bằng “Thêm hạng mục”, “Thêm cửa hàng”, “Thêm phòng” và “Thêm đơn vị”.",
      "Trong một hạng mục, bấm “Thêm mục” và đặt tên, số lượng, đơn vị và phòng — hoặc dùng “Chọn từ thư viện” để lấy sản phẩm bạn đã có.",
      "Trên một mục, bấm “Thêm giá” rồi nhập đơn giá chưa VAT, mức VAT, cửa hàng, nhà cung cấp và link sản phẩm.",
      "Gắn ảnh bằng cách chụp ảnh hoặc đưa vào một URL ảnh.",
      "Đọc tổng chưa VAT và tổng có VAT, cùng số mục vẫn chưa có giá.",
      "Giỏ hàng của một cửa hàng ghi “đủ tất cả” khi cửa hàng đó cung cấp được mọi mục.",
    ],
    whoCanDoIt:
      "Thành viên công trình nào mở được Menu cũng làm được. Máy chủ quyết định có nhận thay đổi của bạn không.",
  },
  {
    id: "documents",
    title: "Tài liệu công trình",
    purpose:
      "Ngăn hồ sơ của công trình — bản vẽ, giấy phép, hợp đồng — kèm nhãn, bộ lọc và cách sắp xếp.",
    steps: [
      "Mở Menu → Tài liệu. Lọc theo loại, người tải lên hoặc nhãn, và sắp xếp theo ngày, tên, kích thước hay người tải.",
      "Bấm “Thêm tài liệu” rồi chụp ảnh, chọn từ thư viện ảnh, hoặc chọn tệp.",
      "Bấm “Sửa” trên một dòng để đổi tên tệp hoặc đặt nhãn, các nhãn cách nhau bằng dấu phẩy.",
      "Bấm “Xoá” để bỏ một tài liệu, sau một lần xác nhận.",
    ],
    whoCanDoIt:
      "Chỉ người quản lý công trình, kể cả việc chỉ để đọc. Không có quyền đó thì mục này không hiện trong Menu.",
  },
  {
    id: "photos",
    title: "Ảnh công trường",
    purpose:
      "Kho ảnh của công trình, có cả video, mỗi ảnh kèm chú thích nếu muốn.",
    steps: [
      "Mở Menu → Ảnh, rồi bấm “Thêm ảnh” để chụp một tấm hoặc chọn từ thư viện ảnh.",
      "Bấm vào một ảnh để mở, viết chú thích rồi bấm “Lưu”.",
      "“Chia sẻ” đưa tệp sang điện thoại; video phải mở theo cách này.",
      "“Xoá” bỏ một ảnh sau một lần xác nhận.",
      "“Tải thêm” lật tiếp các trang ảnh.",
    ],
    whoCanDoIt:
      "Ai ở trong công trình cũng xem được. Thêm ảnh, viết chú thích và xoá thì cần quyền sửa công trình.",
  },
  {
    id: "notes",
    title: "Ghi chú và nhắc nhở của công trình",
    purpose:
      "Những ghi chú có ngày tháng về công trình — kiểm tra, giao hàng, quyết định, cuộc gọi. Ghi chú có ngày đến hạn sẽ thành nhắc nhở trong chuông.",
    steps: [
      "Mở Menu → Ghi chú. Lọc theo danh mục hoặc tìm kiếm.",
      "Thêm một ghi chú: bắt buộc có tiêu đề, rồi chi tiết và danh mục — kiểm tra, giao hàng, thanh toán, quyết định, cuộc gọi hoặc chung.",
      "Bấm vào một ghi chú để sửa.",
      "Dùng “Đánh dấu xong” hoặc “Mở lại” trên một ghi chú, hoặc “Xoá” để bỏ hẳn.",
    ],
    whoCanDoIt:
      "Ai ở trong công trình cũng đọc được. Mọi thay đổi đều cần quyền sửa công trình.",
    gotchas: [
      "Bấm “Bỏ qua” cho một nhắc nhở trong chuông chỉ ẩn nó ở đó; ghi chú thì vẫn còn nguyên.",
    ],
  },
  {
    id: "analyses",
    title: "Báo cáo phân tích",
    purpose:
      "Lưu các báo cáo phân tích dạng HTML theo công trình, tìm kiếm được và gắn nhãn được.",
    steps: [
      "Mở Menu → Phân tích. Tìm kiếm, hoặc lọc theo nhãn.",
      "Bấm nút thêm, chọn báo cáo HTML — bắt buộc — rồi đặt tiêu đề, tóm tắt, link nguồn và nhãn.",
      "Bấm vào một dòng để đọc báo cáo.",
      "“Sửa” mở lại phần thông tin; “Xoá” bỏ bản phân tích sau một lần xác nhận.",
    ],
    whoCanDoIt:
      "Ai ở trong công trình cũng đọc được. Mọi thay đổi đều cần quyền sửa công trình.",
  },
  {
    id: "chat",
    title: "Trò chuyện nhóm",
    purpose:
      "Nhắn tin và gửi ảnh với công ty và đội của công trình, mỗi công ty một kênh và mỗi công trình một kênh.",
    steps: [
      "Bấm nút tin nhắn tròn ở góc dưới bên phải của một tab công trình.",
      "Chọn kênh ở hàng nhãn phía trên; kênh có tin chưa đọc được đánh dấu bằng một chấm.",
      "Gõ tin nhắn rồi gửi.",
      "Bấm + để chọn ảnh, hoặc bấm nút máy ảnh để chụp ảnh gửi kèm.",
      "Ảnh đại diện dưới tin mới nhất cho biết ai đã đọc tới đó.",
    ],
    whoCanDoIt:
      "Ai cũng dùng được. Bạn thấy những kênh nào là theo quyền truy cập công ty và các công trình bạn đang làm.",
    webOnlyNote:
      "Ứng dụng web cũng có cùng phần trò chuyện nhóm, nằm sau nút ở góc màn hình, nên cuộc trò chuyện tiếp tục được ở cả hai nơi.",
    gotchas: [
      "Tin nhắn về theo nhịp hỏi lại máy chủ vài giây một lần, không phải tức thì.",
      "Nút này tự ẩn khi có bảng đang mở và ở những màn hình không thuộc bốn tab.",
    ],
  },
  {
    id: "notifications",
    title: "Chuông",
    purpose:
      "Một chỗ gom mọi việc đang chờ bạn: chấm công cần duyệt, thành viên công ty mới cần xếp vào công trình, và ghi chú đã đến hạn.",
    steps: [
      "Bấm chuông trên thanh đầu màn hình. Có việc đang chờ là có một chấm hiện lên.",
      "Khối đầu tiên là chấm công chờ duyệt — xem chủ đề về duyệt ngày công.",
      "Khối thứ hai liệt kê thành viên công ty mới chưa được phân công vào công trình nào; bấm vào một người để đi xếp họ vào.",
      "Khối thứ ba liệt kê nhắc nhở, mỗi cái kèm danh mục và ngày đến hạn; bấm để mở ghi chú, hoặc bấm “Bỏ qua” để dẹp đi.",
      "Không có gì đến hạn thì bảng chỉ nói đúng như vậy.",
    ],
    whoCanDoIt:
      "Ai cũng thấy chuông; bên trong có gì thì tuỳ từng người. Chấm công về tay người quản lý chấm công, thành viên mới về tay quản trị viên công ty.",
    gotchas: [
      "Thành viên mới chưa được tính vào cái chấm, nên chấm có thể đếm thiếu.",
      "Đây là chuông duyệt việc. Còn thông báo đẩy nào được gửi về máy bạn lại là màn hình khác, ở Cài đặt → Thông báo.",
    ],
  },
  {
    id: "settings",
    title: "Cài đặt, phương thức thanh toán và vai trò",
    purpose:
      "Tài khoản của bạn, các công ty của bạn, và những danh sách mà phần còn lại của app lấy ra dùng: phương thức thanh toán, vai trò nhân công và những thông báo được gửi về máy này.",
    steps: [
      "Bấm chữ viết tắt tên bạn, rồi bấm “Cài đặt”.",
      "“Phương thức thanh toán” đặt tên cho các cách thanh toán hoá đơn của một công ty. Gõ tên rồi bấm “Thêm”; bấm vào một phương thức để đổi tên. “Tiền mặt” là mặc định, không xoá được.",
      "“Vai trò nhân công” giữ các vai trò bạn gắn cho thợ, mỗi vai trò một màu. Bấm “Vai trò mới”, đặt tên, chọn màu rồi lưu.",
      "“Thông báo” chọn những thông báo đẩy được gửi về máy này: một công tắc chính, rồi trò chuyện nhóm, chấm công, công việc, nhóm & quyền truy cập, và tiền.",
      "“Công ty của tôi” liệt kê các công ty bạn thuộc về. Quản trị viên sửa được thông tin pháp lý, phát mã tham gia và mã mời, quản lý người dùng đã liên kết và xoá công ty.",
      "“Gộp người” dồn một người bị trùng vào đúng người kia và chuyển nhân công của họ sang.",
      "Cuối màn hình là phiên bản app và nút “Đăng xuất”.",
    ],
    whoCanDoIt:
      "Ai cũng vào được Cài đặt. Sửa phương thức thanh toán thì cần quyền quản trị công ty. Lựa chọn thông báo là của riêng máy này.",
    gotchas: [
      "Các con số và tên công ty trên những dòng trong Cài đặt lấy từ công ty đầu tiên của bạn, không phải từ công trình bạn đang chọn.",
      "Xoá một phương thức thanh toán không đụng gì tới hoá đơn cũ; nó chỉ khiến hoá đơn mới không chọn được phương thức đó nữa.",
    ],
  },
  {
    id: "worker-attendance",
    title: "Khai ngày công của bạn",
    purpose:
      "Là thợ, bạn tự khai những ngày mình có mặt ở công trường rồi chờ quản lý duyệt.",
    steps: [
      "Chọn ngày bạn muốn khai — lịch nằm bên dưới thẻ chấm công.",
      "Chọn ca của bạn: cả ngày, nửa ngày hoặc tăng ca.",
      "Bấm “Chấm ngày này”. Ngày công được gửi đi ngay, và quản lý của bạn được báo là có việc đang chờ.",
      "Với ngày bạn đã khai, bấm “Sửa ngày này” để đổi ca, giờ thêm hoặc ghi chú.",
      "Khi còn chờ duyệt thì sửa là lưu thẳng; đã được duyệt rồi thì cũng nút đó nhưng gửi đi một yêu cầu sửa.",
      "Các nhãn cho biết mỗi ngày đang ở đâu: chờ duyệt, đã duyệt, hoặc đang xin sửa kèm nội dung bạn xin.",
      "Bên dưới: số ngày công, số tiền bạn kiếm được và phần còn chờ duyệt trong tháng, cùng danh sách ai khác có mặt ở công trường ngày đó.",
    ],
    whoCanDoIt:
      "Là bạn, trên công trình bạn đang chọn, với điều kiện tài khoản của bạn đã được gắn với một nhân công. Chưa gắn thì màn hình bảo bạn đi hỏi quản lý.",
    workerMode: true,
    gotchas: [
      "Bạn khai được hôm nay hoặc một ngày trước đó chưa có bản ghi; ngày trong tương lai thì không được.",
      "Danh sách đội chỉ hiện tên, có mặt và số giờ, không bao giờ hiện lương của ai, trừ khi bạn được phép xem lương.",
    ],
  },
  {
    id: "worker-salary",
    title: "Lương của bạn ở công trình này",
    purpose:
      "Bạn kiếm được bao nhiêu ở công trình này, đã nhận bao nhiêu và còn phải nhận bao nhiêu, theo từng tháng.",
    steps: [
      "Mở tab Lương.",
      "Đọc các tổng: đã kiếm, đã trả và còn phải trả.",
      "Mỗi thẻ tháng cho biết trạng thái, số ngày công, và đã kiếm, đã trả, còn lại bao nhiêu.",
      "Các khoản bạn đã nhận được liệt kê dưới từng tháng.",
    ],
    whoCanDoIt:
      "Là bạn, chỉ để xem. Chỉ quản trị viên hoặc quản lý mới đổi được một tháng là đã trả hay chưa.",
    workerMode: true,
  },
  {
    id: "worker-profile",
    title: "Hồ sơ và lương ngày của bạn",
    purpose:
      "Bạn là ai ở công trình này và lương ngày của bạn đã thay đổi thế nào.",
    steps: [
      "Mở tab Hồ sơ.",
      "Xem tên, vai trò, số điện thoại và công trình bạn đang làm.",
      "“Lương ngày hiện tại” là số tiền mỗi ngày công của bạn đang được tính.",
      "“Lịch sử lương ngày” liệt kê mức lương ban đầu và mọi lần thay đổi từ đó tới nay, ghi rõ lần nào đã áp dụng, lần nào sắp có hiệu lực, kèm mức tăng hay giảm mỗi lần.",
    ],
    whoCanDoIt:
      "Là bạn, chỉ để xem. Đổi lương thì cần quyền quản lý chấm công, mà màn hình này thì đúng là không có quyền đó.",
    workerMode: true,
  },
];

/** The panel's own labels in this language. */
export const helpChromeVi: HelpChrome = {
  title: "Folio hoạt động thế nào",
  subtitle: "Mọi quy trình, từng bước một.",
  back: "Tất cả chủ đề",
  steps: "Các bước",
  whoCanDoIt: "Ai có thể làm",
  gotchas: "Cần lưu ý",
  webOnly: "Trên ứng dụng web",
  workerBadge: "Chế độ thợ",
};
